/**
 * IMPORTANT: This parser logic must be kept in sync with the edge function parser at:
 * supabase/functions/quick-add/index.ts (lines 219-430)
 *
 * Any changes to recurring pattern detection must be updated in BOTH places.
 */

interface RecurrenceResult {
  frequency: string;
  time: string;
  interval?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  originalText?: string;
}

export function parseRecurrenceFromText(text: string): RecurrenceResult | null {
  const lowerText = text.toLowerCase();

  // Helper to parse time from text
  const parseTime = (): string => {
    if (lowerText.includes('morning') || lowerText.includes('morn')) return '09:00';
    if (lowerText.includes('noon')) return '12:00';
    if (lowerText.includes('afternoon')) return '15:00';
    if (lowerText.includes('evening')) return '18:00';
    if (lowerText.includes('night')) return '21:00';

    // Support "a"/"p" abbreviations in addition to "am"/"pm"
    // Allow flexible spacing: "9a", "9 a", "9am", "9 am"
    const timeMatch = text.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*([ap]m?|AM|PM)?/i);
    if (timeMatch && timeMatch[2]) {
      let hours = parseInt(timeMatch[2], 10);
      const minutes = timeMatch[3] ? parseInt(timeMatch[3].slice(1), 10) : 0;

      if (timeMatch[4]) {
        const ampm = timeMatch[4].toLowerCase();
        const isPM = ampm === 'pm' || ampm === 'p';
        const isAM = ampm === 'am' || ampm === 'a';

        console.log('Detected AM/PM:', timeMatch[4], 'isPM:', isPM, 'isAM:', isAM);

        if (isPM && hours !== 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
      } else {
        // No AM/PM specified - apply rules:
        // Rule 2: 12-6 is ALWAYS PM (trumps everything)
        if (hours === 12 || (hours >= 1 && hours <= 6)) {
          hours = hours === 12 ? 12 : hours + 12;
        }
        // Rule 1: 7-11 - assume next occurrence (would need current time, default to PM for now)
        else if (hours >= 7 && hours <= 11) {
          hours += 12; // Default to PM for recurring patterns
        }
      }
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return '09:00';
  };

  // Map month names/abbreviations to numbers
  const parseMonth = (monthStr: string): number => {
    const monthMap: Record<string, number> = {
      'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
      'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
      'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
      'nov': 11, 'november': 11, 'dec': 12, 'december': 12
    };
    return monthMap[monthStr.toLowerCase()] || 0;
  };

  // YEARLY with month+day (most specific, check first)
  const yearlyPattern = /\b(?:(?:every|each)\s+year\s+on\s+|(?:every|each)\s+|(?:yearly|annually)\s+on\s+|on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:every|each)\s+year)?\b/i;
  const yearlyMatch = text.match(yearlyPattern);
  if (yearlyMatch && /\b(?:every|each)\s+year|yearly|annually/.test(lowerText)) {
    const monthOfYear = parseMonth(yearlyMatch[1]);
    const dayOfMonth = parseInt(yearlyMatch[2], 10);
    if (monthOfYear >= 1 && monthOfYear <= 12 && dayOfMonth >= 1 && dayOfMonth <= 31) {
      return { frequency: 'yearly', time: parseTime(), dayOfMonth, monthOfYear, originalText: yearlyMatch[0] };
    }
  }

  // MONTHLY with specific day
  const monthlyDayPattern = /\b(?:(?:every|each)\s+month\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?|monthly\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?|(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(?:every|each)\s+month|(?:every|each)\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+the\s+month)\b/i;
  const monthlyDayMatch = text.match(monthlyDayPattern);
  if (monthlyDayMatch) {
    const dayOfMonth = parseInt(monthlyDayMatch[1] || monthlyDayMatch[2] || monthlyDayMatch[3] || monthlyDayMatch[4], 10);
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      return { frequency: 'monthly', time: parseTime(), dayOfMonth, originalText: monthlyDayMatch[0] };
    }
  }

  // Helper to build full originalText including time pattern
  const buildOriginalText = (patternMatch: string): string => {
    const timeMatch = text.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*([ap]m?|AM|PM)?/i);
    if (timeMatch) {
      // Find the position of both matches to combine them properly
      const patternIndex = text.toLowerCase().indexOf(patternMatch.toLowerCase());
      const timeIndex = text.indexOf(timeMatch[0]);

      if (timeIndex > patternIndex) {
        // Time comes after pattern: "every day at 9 a"
        return text.substring(patternIndex, timeIndex + timeMatch[0].length);
      } else {
        // Time comes before pattern: "at 9 a every day"
        return text.substring(timeIndex, patternIndex + patternMatch.length);
      }
    }
    return patternMatch;
  };

  // WEEKLY with day
  const weeklyDayPattern = /\b(?:every|each)\s+(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/i;
  const weeklyDayMatch = text.match(weeklyDayPattern);
  if (weeklyDayMatch) {
    return { frequency: 'weekly', time: parseTime(), originalText: buildOriginalText(weeklyDayMatch[0]) };
  }

  // BIWEEKLY
  const biweeklyPattern = /\b(?:every|each)\s+(other|2nd|second)\s+(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/i;
  const biweeklyMatch = text.match(biweeklyPattern);
  if (biweeklyMatch) {
    return { frequency: 'weekly', time: parseTime(), interval: 2, originalText: buildOriginalText(biweeklyMatch[0]) };
  }

  // MINUTELY
  const minutelyPattern = /\b(?:every|each)\s+(\d+)\s+minutes?\b/i;
  const minutelyMatch = text.match(minutelyPattern);
  if (minutelyMatch) {
    const interval = parseInt(minutelyMatch[1], 10);
    // For interval-based, use current time (will be calculated in edge function/display)
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return { frequency: 'minutely', time: currentTime, interval, originalText: minutelyMatch[0] };
  }

  // HOURLY
  const hourlyPattern = /\b(?:every|each)\s+(\d+)\s+hours?\b/i;
  const hourlyMatch = text.match(hourlyPattern);
  if (hourlyMatch) {
    const interval = parseInt(hourlyMatch[1], 10);
    // For interval-based, use current time (will be calculated in edge function/display)
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return { frequency: 'hourly', time: currentTime, interval, originalText: hourlyMatch[0] };
  }

  // DAILY (also support "everyday" as one word)
  if (/\b((?:every|each)\s+day|daily|everyday)\b/i.test(text)) {
    const dailyMatch = text.match(/\b((?:every|each)\s+day|daily|everyday)\b/i)?.[0] || '';
    return { frequency: 'daily', time: parseTime(), originalText: buildOriginalText(dailyMatch) };
  }

  // WEEKLY (generic)
  if (/\b((?:every|each)\s+week|weekly)\b/i.test(text)) {
    const weeklyMatch = text.match(/\b((?:every|each)\s+week|weekly)\b/i)?.[0] || '';
    return { frequency: 'weekly', time: parseTime(), originalText: buildOriginalText(weeklyMatch) };
  }

  // MONTHLY (generic - defaults to current day)
  if (/\b((?:every|each)\s+month|monthly)\b/i.test(text)) {
    const now = new Date();
    const monthlyMatch = text.match(/\b((?:every|each)\s+month|monthly)\b/i)?.[0] || '';
    return { frequency: 'monthly', time: parseTime(), dayOfMonth: now.getDate(), originalText: buildOriginalText(monthlyMatch) };
  }

  // YEARLY (generic - defaults to current month/day)
  if (/\b((?:every|each)\s+year|yearly|annually)\b/i.test(text)) {
    const now = new Date();
    const yearlyMatch = text.match(/\b((?:every|each)\s+year|yearly|annually)\b/i)?.[0] || '';
    return { frequency: 'yearly', time: parseTime(), dayOfMonth: now.getDate(), monthOfYear: now.getMonth() + 1, originalText: buildOriginalText(yearlyMatch) };
  }

  return null;
}
