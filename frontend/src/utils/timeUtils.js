/**
 * Tính số giờ làm việc thực tế giữa 2 mốc thời gian.
 * Quy tắc:
 * - Thời gian làm việc: 08:00 - 17:30 (8 tiếng/ngày)
 * - Nghỉ trưa: 11:30 - 13:00 (1.5 tiếng)
 * - Không tính Thứ 7 và Chủ Nhật
 */
export function calculateWorkingHours(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start >= end) return 0;
  
  let totalHours = 0;
  let current = new Date(start);
  
  while (current <= end) {
    // Bỏ qua Thứ 7 (6) và Chủ Nhật (0)
    const isWeekend = current.getDay() === 0 || current.getDay() === 6;
    if (!isWeekend) {
      const dayStart = new Date(current);
      dayStart.setHours(8, 0, 0, 0); // 08:00
      
      const morningEnd = new Date(current);
      morningEnd.setHours(11, 30, 0, 0); // 11:30
      
      const afternoonStart = new Date(current);
      afternoonStart.setHours(13, 0, 0, 0); // 13:00
      
      const dayEnd = new Date(current);
      dayEnd.setHours(17, 30, 0, 0); // 17:30
      
      // Xác định khoảng thời gian làm việc trong ngày hiện tại
      let workStart = current;
      if (current.toDateString() !== start.toDateString()) {
        workStart = dayStart;
      }
      
      let workEnd = new Date(current);
      workEnd.setHours(23, 59, 59, 999);
      if (current.toDateString() === end.toDateString()) {
        workEnd = end;
      }
      
      // Tính overlap với ca sáng (08:00 - 11:30)
      const msStart = Math.max(workStart.getTime(), dayStart.getTime());
      const msEnd = Math.min(workEnd.getTime(), morningEnd.getTime());
      if (msStart < msEnd) {
        totalHours += (msEnd - msStart) / (1000 * 60 * 60);
      }
      
      // Tính overlap với ca chiều (13:00 - 17:30)
      const asStart = Math.max(workStart.getTime(), afternoonStart.getTime());
      const asEnd = Math.min(workEnd.getTime(), dayEnd.getTime());
      if (asStart < asEnd) {
        totalHours += (asEnd - asStart) / (1000 * 60 * 60);
      }
    }
    
    // Chuyển sang ngày tiếp theo (đầu ngày)
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  
  // Làm tròn 1 chữ số thập phân
  return Math.round(totalHours * 10) / 10;
}
