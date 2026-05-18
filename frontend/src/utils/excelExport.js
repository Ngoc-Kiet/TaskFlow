/**
 * Excel Export Utility - Xuất báo cáo theo format Report Template 1
 * Sử dụng XML Spreadsheet 2003 format (không cần thư viện bên ngoài)
 * 
 * Columns: WBS | Task Name | Env/Version | Status | %Complete | Start | Finish | Estimate(hours) | Effort(hours) | Chi tiết task
 */

const STATUS_MAP = {
  'todo': 'To Do',
  'inprogress': 'In Progress',
  'done': 'Done',
  'review': 'Review',
  'block': 'Block'
}

const STATUS_PERCENT = {
  'todo': 0,
  'inprogress': 0.5,
  'done': 1,
  'review': 0.8,
  'block': 0
}

/**
 * Format date to Excel serial number compatible string
 */
function formatDateForExcel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T00:00:00.000`
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate WBS numbering for tasks grouped by status columns
 */
function generateWBS(tasks, columns) {
  const result = []
  let mainIndex = 1

  columns.forEach(column => {
    const columnTasks = tasks
      .filter(t => t.status === column.id)
      .sort((a, b) => a.order - b.order)

    if (columnTasks.length === 0) return

    // Add column header row
    result.push({
      wbs: String(mainIndex),
      title: column.title,
      isGroup: true,
      status: '',
      percent: '',
      startDate: '',
      deadline: '',
      estimatedHours: '',
      actualHours: '',
      description: '',
      tags: ''
    })

    // Add tasks under this column
    columnTasks.forEach((task, idx) => {
      const assigneeNames = (task.assignees || [])
        .map(a => typeof a === 'object' ? a.name : a)
        .filter(Boolean)
        .join(', ')

      result.push({
        wbs: `${mainIndex}.${idx + 1}`,
        title: task.title,
        isGroup: false,
        status: STATUS_MAP[task.status] || task.status,
        percent: STATUS_PERCENT[task.status] ?? 0,
        startDate: task.startDate,
        deadline: task.deadline,
        estimatedHours: task.estimatedHours || '',
        actualHours: task.actualHours || '',
        description: task.description || '',
        tags: (task.tags || []).join(', '),
        assignees: assigneeNames
      })
    })

    mainIndex++
  })

  return result
}

/**
 * Build XML Spreadsheet content
 */
function buildXMLSpreadsheet(projectName, rows) {
  const headerStyle = `
    <Style ss:ID="header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1F4E79"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1F4E79"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1F4E79"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1F4E79"/>
      </Borders>
      <Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="11"/>
      <Interior ss:Color="#1F4E79" ss:Pattern="Solid"/>
    </Style>`

  const groupStyle = `
    <Style ss:ID="group">
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
      </Borders>
      <Font ss:Bold="1" ss:Color="#1F4E79" ss:FontName="Calibri" ss:Size="11"/>
      <Interior ss:Color="#D6E4F0" ss:Pattern="Solid"/>
    </Style>`

  const dataStyle = `
    <Style ss:ID="data">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
    </Style>`

  const dataCenter = `
    <Style ss:ID="dataCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
    </Style>`

  const percentStyle = `
    <Style ss:ID="percent">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <NumberFormat ss:Format="0%"/>
    </Style>`

  const dateStyle = `
    <Style ss:ID="dateStyle">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <NumberFormat ss:Format="dd/mm/yyyy"/>
    </Style>`

  // Status conditional styles
  const statusDone = `
    <Style ss:ID="statusDone">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#006100"/>
      <Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/>
    </Style>`

  const statusInProgress = `
    <Style ss:ID="statusInProgress">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#9C5700"/>
      <Interior ss:Color="#FFEB9C" ss:Pattern="Solid"/>
    </Style>`

  const statusTodo = `
    <Style ss:ID="statusTodo">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#3F3F76"/>
      <Interior ss:Color="#D9E2F3" ss:Pattern="Solid"/>
    </Style>`

  // Build data rows
  let dataRows = ''
  rows.forEach(row => {
    if (row.isGroup) {
      dataRows += `
      <Row ss:AutoFitHeight="1">
        <Cell ss:StyleID="group"><Data ss:Type="String">${escapeXml(row.wbs)}</Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String">${escapeXml(row.title)}</Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="group"><Data ss:Type="String"></Data></Cell>
      </Row>`
    } else {
      const statusStyleId = row.status === 'Done' ? 'statusDone'
        : row.status === 'In Progress' ? 'statusInProgress'
        : 'statusTodo'

      const startDateXml = row.startDate
        ? `<Cell ss:StyleID="dateStyle"><Data ss:Type="DateTime">${formatDateForExcel(row.startDate)}</Data></Cell>`
        : `<Cell ss:StyleID="dateStyle"><Data ss:Type="String"></Data></Cell>`

      const deadlineXml = row.deadline
        ? `<Cell ss:StyleID="dateStyle"><Data ss:Type="DateTime">${formatDateForExcel(row.deadline)}</Data></Cell>`
        : `<Cell ss:StyleID="dateStyle"><Data ss:Type="String"></Data></Cell>`

      const estHours = row.estimatedHours
        ? `<Cell ss:StyleID="dataCenter"><Data ss:Type="Number">${row.estimatedHours}</Data></Cell>`
        : `<Cell ss:StyleID="dataCenter"><Data ss:Type="String"></Data></Cell>`

      const actHours = row.actualHours
        ? `<Cell ss:StyleID="dataCenter"><Data ss:Type="Number">${row.actualHours}</Data></Cell>`
        : `<Cell ss:StyleID="dataCenter"><Data ss:Type="String"></Data></Cell>`

      dataRows += `
      <Row ss:AutoFitHeight="1">
        <Cell ss:StyleID="dataCenter"><Data ss:Type="String">${escapeXml(row.wbs)}</Data></Cell>
        <Cell ss:StyleID="data"><Data ss:Type="String">${escapeXml(row.title)}</Data></Cell>
        <Cell ss:StyleID="dataCenter"><Data ss:Type="String">${escapeXml(row.tags)}</Data></Cell>
        <Cell ss:StyleID="${statusStyleId}"><Data ss:Type="String">${escapeXml(row.status)}</Data></Cell>
        <Cell ss:StyleID="percent"><Data ss:Type="Number">${row.percent}</Data></Cell>
        ${startDateXml}
        ${deadlineXml}
        ${estHours}
        ${actHours}
        <Cell ss:StyleID="data"><Data ss:Type="String">${escapeXml(row.description)}</Data></Cell>
      </Row>`
    }
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXml(projectName)} - Timeline Report</Title>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10"/>
    </Style>
    ${headerStyle}
    ${groupStyle}
    ${dataStyle}
    ${dataCenter}
    ${percentStyle}
    ${dateStyle}
    ${statusDone}
    ${statusInProgress}
    ${statusTodo}
  </Styles>
  <Worksheet ss:Name="Timeline">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="50"/>
      <Column ss:Width="280"/>
      <Column ss:Width="90"/>
      <Column ss:Width="85"/>
      <Column ss:Width="85"/>
      <Column ss:Width="85"/>
      <Column ss:Width="85"/>
      <Column ss:Width="65"/>
      <Column ss:Width="60"/>
      <Column ss:Width="300"/>
      <Row ss:AutoFitHeight="1" ss:Height="35">
        <Cell ss:StyleID="header"><Data ss:Type="String">WBS</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">PYC - Task Name</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Env&#10;Version</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">       Status       </Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">%&#10;Complete</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">      Start      </Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">     Finish     </Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Estimate&#10;(hours)</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Effort&#10;(hours)</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Chi tiết task / Tiến độ chi tiết</Data></Cell>
      </Row>
      ${dataRows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`
}

/**
 * Main export function
 * @param {Object} project - Project object with name, columns
 * @param {Array} tasks - Array of task objects
 */
export function exportProjectToExcel(project, tasks) {
  const columns = project.columns || [
    { id: 'todo', title: 'To Do' },
    { id: 'inprogress', title: 'In Progress' },
    { id: 'done', title: 'Done' }
  ]

  const rows = generateWBS(tasks, columns)
  const xmlContent = buildXMLSpreadsheet(project.name, rows)

  // Create and download file
  const blob = new Blob([xmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8'
  })

  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const fileName = `${project.name}_Timeline_${dateStr}.xls`

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)

  return fileName
}
