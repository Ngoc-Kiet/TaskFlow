import { useState, useMemo } from 'react'
import { projectService } from '../../services'

function getWeekBounds(weeksAgo = 0) {
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // 1=Mon … 7=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek - 1) - weeksAgo * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

export default function ExportWeeklyReportModal({ onClose }) {
  const [weeksAgo, setWeeksAgo] = useState(0) // 0 = tuần này, 1 = tuần trước...
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const { start, end } = getWeekBounds(weeksAgo)

  const weekLabel = weeksAgo === 0 ? 'Tuần này' : weeksAgo === 1 ? 'Tuần trước' : `${weeksAgo} tuần trước`
  const dateRange = `${start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${end.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const blob = await projectService.exportAllExcel({ weeksAgo })
      
      // Tạo link download blob
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]
      link.setAttribute('download', `Bao_Cao_Tuan_Tat_Ca_Du_An_${startStr}_den_${endStr}.xlsx`)
      
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      onClose()
    } catch (err) {
      console.error('Lỗi khi xuất excel:', err)
      setError('Đã xảy ra lỗi trong quá trình xuất file Excel. Vui lòng thử lại.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-dark-900 border border-slate-700/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-slide-up flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              📊 Báo cáo tất cả dự án
            </h2>
            <p className="text-slate-500 text-xs mt-1">Xuất toàn bộ công việc theo tuần</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
            disabled={exporting}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          <div className="glass-card p-4 space-y-4">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Chọn tuần báo cáo
            </label>

            {/* Selector */}
            <div className="flex items-center justify-between bg-dark-800 rounded-lg p-2 border border-slate-700/50">
              <button
                type="button"
                onClick={() => setWeeksAgo(v => v + 1)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all text-lg font-bold"
                disabled={exporting}
              >
                ‹
              </button>
              <div className="text-center flex-1 px-4">
                <span className="text-sm font-semibold text-slate-200 block">{weekLabel}</span>
                <span className="text-xs text-slate-500 block mt-0.5">{dateRange}</span>
              </div>
              <button
                type="button"
                onClick={() => setWeeksAgo(v => Math.max(0, v - 1))}
                disabled={weeksAgo === 0 || exporting}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all text-lg font-bold disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              ⚠️ {error}
            </div>
          )}

          <div className="text-xs text-slate-500 leading-relaxed bg-slate-800/30 p-3.5 rounded-lg border border-slate-800/50">
            ℹ️ File Excel xuất ra sẽ chứa danh sách tất cả dự án hoạt động trong tuần đã chọn. Cấu trúc file bao gồm thông tin chi tiết về từng đầu việc, người thực hiện, độ ưu tiên, trạng thái và tỷ lệ hoàn thành.
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-dark-950/40 border-t border-slate-800/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            disabled={exporting}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="btn-primary flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg"
            disabled={exporting}
          >
            {exporting ? (
              <>
                <span className="spinner w-4 h-4" />
                Đang xuất...
              </>
            ) : (
              <>
                📥 Xuất file Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
