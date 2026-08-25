/**
 * 将 ISO 日期字符串格式化为中文日期
 * @param isoString ISO 日期字符串
 * @param format 格式类型，可选值: "full" | "short" | "time"
 * @returns 中文格式化后的日期字符串
 */
export default function formatEventDate(
    isoString: string,
    format: 'full' | 'short' | 'time' = 'full'
  ): string  {
    const date = new Date(isoString)
  
    const formats: Record<'full' | 'short' | 'time', Intl.DateTimeFormatOptions> = {
      full: {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Shanghai'
      },
      short: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Shanghai'
      },
      time: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai'
      }
    }
  
    if (format === 'time') {
      return date.toLocaleTimeString('zh-CN', formats.time)
    }
  
    return date.toLocaleDateString('zh-CN', formats[format])
  }
  