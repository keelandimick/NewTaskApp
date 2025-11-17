import * as chrono from 'chrono-node';

// Create a custom chrono instance with specific parsing rules
const customChrono = chrono.casual.clone();

// Custom refiner to handle AM/PM defaults
customChrono.refiners.push({
  refine: (context, results) => {
    results.forEach((result) => {
      const components = result.start;
      
      // If we have an hour but no meridiem (AM/PM) specified
      if (components.get('hour') !== null && !components.isCertain('meridiem')) {
        const hour = components.get('hour');
        
        // TypeScript safety check
        if (hour === null) return;
        
        // Only use AM for 8, 9, 10, 11
        if (hour >= 8 && hour <= 11) {
          // Could be either AM or PM, but for 8-11, lean towards AM if it makes sense
          const refDate = result.refDate || new Date();
          const currentHour = refDate.getHours();
          
          // If current time is after this hour, assume PM to keep it in the future
          if (currentHour >= hour) {
            components.assign('meridiem', 1); // PM
            components.assign('hour', hour + 12 === 24 ? 12 : hour + 12);
          } else {
            components.assign('meridiem', 0); // AM
          }
        } else if (hour >= 1 && hour <= 7) {
          // 1-7 are always PM
          components.assign('meridiem', 1); // PM
          components.assign('hour', hour + 12);
        } else if (hour === 12) {
          // 12 is PM (noon)
          components.assign('meridiem', 1); // PM
        }
      }
      
      // Ensure times are always in the future
      const resultDate = result.date();
      const now = new Date();
      
      // If the parsed time is in the past and it's today, move it to tomorrow
      if (resultDate < now && 
          resultDate.toDateString() === now.toDateString() && 
          components.get('day') === null) {
        // The time is today but in the past, and no specific day was mentioned
        const tomorrow = new Date(resultDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        components.assign('day', tomorrow.getDate());
        components.assign('month', tomorrow.getMonth() + 1);
        components.assign('year', tomorrow.getFullYear());
      }
    });
    
    return results;
  }
});

export default customChrono;