import sys
import json
import zipfile
import shutil
import tempfile
import os
import re
from datetime import datetime


def format_date_serial(date_str):
    if not date_str:
        return ''
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        delta = dt - datetime(1899, 12, 30, tzinfo=dt.tzinfo)
        return str(delta.days + (delta.seconds / 86400.0))
    except Exception:
        return ''


def escape_xml(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def process(input_json_path, template_path, output_path):
    with open(input_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    projects_data = data.get('projects', [])
    rows = []

    st_map = {'todo': 'Chưa làm', 'inprogress': 'Đang làm', 'done': 'Hoàn thành', 'cancel': 'Hủy', 'in-progress': 'Đang làm'}
    priority_map = {'low': 'Thấp', 'medium': 'Trung bình', 'high': 'Cao', 'urgent': 'Khẩn cấp'}

    def get_is_overdue(task):
        if task.get('status') in ['done', 'cancel']:
            return False
        dl = task.get('deadline')
        if not dl:
            return False
        try:
            dl_dt = datetime.fromisoformat(dl.replace('Z', '+00:00'))
            return dl_dt < datetime.now(tz=dl_dt.tzinfo)
        except Exception:
            return False

    priority_sort = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3}
    status_sort = {'todo': 0, 'inprogress': 1, 'in-progress': 1, 'done': 2, 'cancel': 3}

    main_idx = 1
    for proj in projects_data:
        proj_name = proj.get('name', 'Dự án không tên')
        proj_tasks = proj.get('tasks', [])

        # Sắp xếp: task trễ hạn lên đầu, rồi theo độ ưu tiên, rồi theo trạng thái
        proj_tasks.sort(key=lambda x: (
            0 if get_is_overdue(x) else 1,
            priority_sort.get(x.get('priority', 'medium'), 2),
            status_sort.get(x.get('status', ''), 999),
            x.get('order', 0)
        ))

        # Tính toán phần trăm hoàn thành và giờ ước lượng/thực tế của dự án
        total_proj_pct = 0
        total_proj_estimate = 0
        total_proj_effort = 0

        task_rows = []
        task_idx = 1

        for t in proj_tasks:
            t_st = st_map.get(t.get('status', ''), t.get('status', ''))
            prio = priority_map.get(t.get('priority', 'medium'), t.get('priority', ''))
            checklist = t.get('checklist', [])

            # Tính phần trăm hoàn thành của task
            if checklist:
                total_pct = 0
                total_effort = 0
                for c in checklist:
                    c_st = st_map.get(c.get('status', ''), c.get('status', ''))
                    total_pct += (1 if c_st == 'Hoàn thành' else (0.5 if c_st == 'Đang làm' else 0))
                    try:
                        total_effort += float(c.get('actualHours', 0) or 0)
                    except ValueError:
                        pass
                t_pct = total_pct / len(checklist)
                t_effort = str(total_effort) if total_effort > 0 else ''
            else:
                t_pct = 1 if t_st == 'Hoàn thành' else (0.5 if t_st == 'Đang làm' else 0)
                t_effort = str(t.get('actualHours', '')) if t.get('actualHours') else ''

            total_proj_pct += t_pct
            try:
                total_proj_estimate += float(t.get('estimatedHours', 0) or 0)
            except ValueError:
                pass
            try:
                total_proj_effort += float(t_effort or 0)
            except ValueError:
                pass

            assignee_names = ", ".join([a.get('name', '') for a in t.get('assignees') or [] if a.get('name')])

            # Xác định task quá hạn và tính số ngày trễ
            is_overdue = get_is_overdue(t)
            days_overdue_val = ''
            if is_overdue:
                try:
                    dl_dt = datetime.fromisoformat(t.get('deadline').replace('Z', '+00:00'))
                    days = (datetime.now(tz=dl_dt.tzinfo) - dl_dt).days
                    days_overdue_val = f"+{days} ngày" if days > 0 else "+<1 ngày"
                except Exception:
                    days_overdue_val = 'Trễ'

            title_val = f"⚠ {t.get('title', '')}" if is_overdue else t.get('title', '')
            if not assignee_names:
                assignee_names = "⚠ Chưa phân công"

            task_rows.append({
                'isGroup': False,
                'wbs': f"{main_idx}.{task_idx}",
                'title': title_val,
                'status': t_st,
                'percent': str(t_pct),
                'start': format_date_serial(t.get('startDate')),
                'finish': format_date_serial(t.get('deadline')),
                'estimate': str(t.get('estimatedHours', '')) if t.get('estimatedHours') else '',
                'effort': t_effort,
                'details': t.get('description', '') or '',
                'priority': prio,
                'assignees': assignee_names,
                'checklist': checklist,
                'is_overdue': is_overdue,
                'days_overdue': days_overdue_val
            })
            task_idx += 1

        proj_pct = total_proj_pct / len(proj_tasks) if proj_tasks else 0

        # Tính thống kê cho dòng tóm tắt dự án
        overdue_cnt = sum(1 for tr in task_rows if tr.get('is_overdue'))
        inprogress_cnt = sum(1 for tr in task_rows if tr['status'] == 'Đang làm')
        done_cnt = sum(1 for tr in task_rows if tr['status'] == 'Hoàn thành')
        todo_cnt = sum(1 for tr in task_rows if tr['status'] == 'Chưa làm')
        summary_parts = [f"{len(proj_tasks)} task"]
        if overdue_cnt:
            summary_parts.append(f"{overdue_cnt} trễ hạn 🔴")
        if inprogress_cnt:
            summary_parts.append(f"{inprogress_cnt} đang làm")
        if done_cnt:
            summary_parts.append(f"{done_cnt} hoàn thành")
        if todo_cnt:
            summary_parts.append(f"{todo_cnt} chưa bắt đầu")
        proj_detail = " | ".join(summary_parts)

        # Thêm dòng Dự án (Group lớn, WBS = i)
        rows.append({
            'isGroup': True,
            'wbs': str(main_idx),
            'title': f"📁 {proj_name.upper()}",
            'status': 'Hoàn thành' if proj_pct == 1 else ('Đang làm' if proj_pct > 0 else 'Chưa làm'),
            'percent': str(proj_pct),
            'start': '',
            'finish': '',
            'estimate': str(total_proj_estimate) if total_proj_estimate > 0 else '',
            'effort': str(total_proj_effort) if total_proj_effort > 0 else '',
            'details': proj_detail,
            'priority': '',
            'assignees': '',
            'is_overdue': False
        })

        # Thêm các dòng task và checklist của dự án
        for tr in task_rows:
            checklist = tr.pop('checklist', [])
            rows.append(tr)
            
            if checklist:
                for ci, c in enumerate(checklist):
                    c_st = st_map.get(c.get('status', ''), c.get('status', ''))
                    c_pct = 1 if c_st == 'Hoàn thành' else (0.5 if c_st == 'Đang làm' else 0)
                    rows.append({
                        'isGroup': False,
                        'wbs': f"{tr['wbs']}.{ci + 1}",
                        'title': f"   - {c.get('title', '')}",
                        'status': c_st,
                        'percent': str(c_pct),
                        'start': '',
                        'finish': '',
                        'estimate': '',
                        'effort': str(c.get('actualHours', '')) if c.get('actualHours') else '',
                        'details': '',
                        'priority': '',
                        'assignees': '',
                        'is_overdue': False
                    })

        main_idx += 1

    # =========================================================
    # EXTRACT TEMPLATE
    # =========================================================
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(template_path, 'r') as zin:
        zin.extractall(temp_dir)

    # =========================================================
    # PROCESS STYLES XML
    # =========================================================
    status_overdue_style = '75'
    finish_overdue_style = '76'
    ov_left_style_idx = '77'
    ov_pct_style_idx = '78'
    ov_num_style_idx = '79'
    ws_assignees_idx = '80'
    ws_pct_idx = '81'
    ws_date_idx = '82'
    ws_num_idx = '83'
    ws_text_idx = '84'
    st_done_idx = '85'
    st_inprog_idx = '86'
    st_todo_idx = '87'
    st_cancel_idx = '88'

    styles_path = os.path.join(temp_dir, 'xl', 'styles.xml')
    if os.path.exists(styles_path):
        with open(styles_path, 'r', encoding='utf-8') as f:
            styles_xml = f.read()

        # 1. Chèn font mới (fontId_new = fonts_count)
        fontId_new = 33
        m_fonts = re.search(r'<fonts\s+count="(\d+)"', styles_xml)
        if m_fonts:
            fonts_count = int(m_fonts.group(1))
            fontId_new = fonts_count
            new_fonts_count = fonts_count + 1
            styles_xml = re.sub(r'<fonts\s+count="\d+"', f'<fonts count="{new_fonts_count}"', styles_xml, count=1)
            new_font = '<font><sz val="10"/><color rgb="FF9C0006"/><name val="Times New Roman"/><family val="1"/></font>'
            styles_xml = styles_xml.replace('</fonts>', new_font + '</fonts>', 1)

        # 2. Chèn fill mới (fillId_new = fills_count)
        fillId_new = 16
        m_fills = re.search(r'<fills\s+count="(\d+)"', styles_xml)
        if m_fills:
            fills_count = int(m_fills.group(1))
            fillId_new = fills_count
            new_fills_count = fills_count + 1
            styles_xml = re.sub(r'<fills\s+count="\d+"', f'<fills count="{new_fills_count}"', styles_xml, count=1)
            new_fill = '<fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill>'
            styles_xml = styles_xml.replace('</fills>', new_fill + '</fills>', 1)

        # 3. Chèn cellXfs mới (Style index status_overdue_style và finish_overdue_style)
        m_xfs = re.search(r'<cellXfs\s+count="(\d+)"', styles_xml)
        if m_xfs:
            xfs_count = int(m_xfs.group(1))
            status_overdue_style = str(xfs_count)
            finish_overdue_style = str(xfs_count + 1)
            ov_left_style_idx = str(xfs_count + 2)
            ov_pct_style_idx = str(xfs_count + 3)
            ov_num_style_idx = str(xfs_count + 4)
            ws_assignees_idx = str(xfs_count + 5)
            ws_pct_idx = str(xfs_count + 6)
            ws_date_idx = str(xfs_count + 7)
            ws_num_idx = str(xfs_count + 8)
            ws_text_idx = str(xfs_count + 9)
            st_done_idx = str(xfs_count + 10)
            st_inprog_idx = str(xfs_count + 11)
            st_todo_idx = str(xfs_count + 12)
            st_cancel_idx = str(xfs_count + 13)
            new_xfs_count = xfs_count + 14
            styles_xml = re.sub(r'<cellXfs\s+count="\d+"', f'<cellXfs count="{new_xfs_count}"', styles_xml, count=1)

            # Overdue styles (nền đỏ hồng)
            style_status_overdue = f'<xf numFmtId="0" fontId="{fontId_new}" fillId="{fillId_new}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            style_finish_overdue = f'<xf numFmtId="14" fontId="{fontId_new}" fillId="{fillId_new}" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            style_ov_left = f'<xf numFmtId="0" fontId="{fontId_new}" fillId="{fillId_new}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'
            style_ov_pct = f'<xf numFmtId="9" fontId="{fontId_new}" fillId="{fillId_new}" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            style_ov_num = f'<xf numFmtId="0" fontId="{fontId_new}" fillId="{fillId_new}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            # Nền trắng cho các ô task thường (thay thế fillId=4 bằng fillId=2)
            style_ws_assignees = '<xf numFmtId="0" fontId="14" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'
            style_ws_pct = '<xf numFmtId="9" fontId="13" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
            style_ws_date = '<xf numFmtId="164" fontId="15" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_ws_num = '<xf numFmtId="0" fontId="13" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
            style_ws_text = '<xf numFmtId="0" fontId="12" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
            # Status badge (chỉ cột D): màu theo trạng thái, nền trắng phần còn lại
            style_st_done = '<xf numFmtId="0" fontId="11" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_st_inprog = '<xf numFmtId="0" fontId="15" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_st_todo = '<xf numFmtId="0" fontId="17" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_st_cancel = '<xf numFmtId="0" fontId="12" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            all_new_styles = (style_status_overdue + style_finish_overdue + style_ov_left + style_ov_pct + style_ov_num
                              + style_ws_assignees + style_ws_pct + style_ws_date + style_ws_num + style_ws_text
                              + style_st_done + style_st_inprog + style_st_todo + style_st_cancel)
            styles_xml = styles_xml.replace('</cellXfs>', all_new_styles + '</cellXfs>', 1)

        with open(styles_path, 'w', encoding='utf-8') as f:
            f.write(styles_xml)

    # =========================================================
    # SHARED STRINGS
    # =========================================================
    sst_path = os.path.join(temp_dir, 'xl', 'sharedStrings.xml')
    with open(sst_path, 'r', encoding='utf-8') as f:
        sst_xml = f.read()

    # Parse existing strings
    string_cache = {}
    si_blocks = re.findall(r'<si.*?>.*?</si>', sst_xml, flags=re.DOTALL)
    for idx, si in enumerate(si_blocks):
        text_matches = re.findall(r'<t[^>]*>(.*?)</t>', si)
        text = ''.join(text_matches)
        text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
        if text not in string_cache:
            string_cache[text] = idx

    next_str_idx = len(si_blocks)
    new_si_list = []

    def get_string_index(val):
        nonlocal next_str_idx
        val = str(val)
        if val in string_cache:
            return string_cache[val]

        if val.startswith(' ') or val.endswith(' '):
            si_xml = f'<si><t xml:space="preserve">{escape_xml(val)}</t></si>'
        else:
            si_xml = f'<si><t>{escape_xml(val)}</t></si>'

        new_si_list.append(si_xml)
        idx = next_str_idx
        string_cache[val] = idx
        next_str_idx += 1
        return idx

    # =========================================================
    # CREATE CELL XML
    # =========================================================
    def make_cell(r_ref, s_idx, val, is_num=False, is_date=False):
        if val == '' or val is None:
            return f'<c r="{r_ref}" s="{s_idx}"/>'
        if is_num or is_date:
            return f'<c r="{r_ref}" s="{s_idx}"><v>{val}</v></c>'
        idx = get_string_index(str(val))
        return f'<c r="{r_ref}" s="{s_idx}" t="s"><v>{idx}</v></c>'

    # =========================================================
    # BUILD ROW XML
    # =========================================================
    new_rows_xml = []
    row_idx = 2

    for r in rows:
        cells = []
        if r['isGroup']:
            if r['status'] == 'Hoàn thành':
                st_style = st_done_idx
            elif r['status'] == 'Đang làm':
                st_style = st_inprog_idx
            elif r['status'] == 'Hủy':
                st_style = st_cancel_idx
            else:
                st_style = st_todo_idx
            cells.append(make_cell(f'A{row_idx}', '23', r['wbs']))
            cells.append(make_cell(f'B{row_idx}', '24', r['title']))
            cells.append(make_cell(f'C{row_idx}', '25', r.get('assignees', '')))
            cells.append(make_cell(f'D{row_idx}', st_style, r['status']))
            cells.append(make_cell(f'E{row_idx}', '26', r['percent'], is_num=True))
            cells.append(make_cell(f'F{row_idx}', '27', r['start'], is_date=True))
            cells.append(make_cell(f'G{row_idx}', '27', r['finish'], is_date=True))
            cells.append(make_cell(f'H{row_idx}', '28', r['estimate'], is_num=True))
            cells.append(make_cell(f'I{row_idx}', '28', r['effort'], is_num=True))
            cells.append(make_cell(f'J{row_idx}', '29', r['details']))
            cells.append(make_cell(f'K{row_idx}', '29', ''))
            cells.append(make_cell(f'L{row_idx}', '29', r['priority']))
        else:
            is_ov = r.get('is_overdue', False)
            if is_ov:
                s_wbs = ov_left_style_idx
                s_title = ov_left_style_idx
                s_assignees = status_overdue_style
                s_status = status_overdue_style
                s_pct = ov_pct_style_idx
                s_date = finish_overdue_style
                s_num = ov_num_style_idx
                s_text = ov_left_style_idx
            else:
                s_wbs = '30'
                s_title = '31'
                s_assignees = ws_assignees_idx
                s_pct = ws_pct_idx
                s_date = ws_date_idx
                s_num = ws_num_idx
                s_text = ws_text_idx
                if r['status'] == 'Hoàn thành':
                    s_status = st_done_idx
                elif r['status'] == 'Đang làm':
                    s_status = st_inprog_idx
                elif r['status'] == 'Hủy':
                    s_status = st_cancel_idx
                else:
                    s_status = st_todo_idx

            cells.append(make_cell(f'A{row_idx}', s_wbs, r['wbs']))
            cells.append(make_cell(f'B{row_idx}', s_title, r['title']))
            cells.append(make_cell(f'C{row_idx}', s_assignees, r.get('assignees', '')))
            cells.append(make_cell(f'D{row_idx}', s_status, r['status']))
            cells.append(make_cell(f'E{row_idx}', s_pct, r['percent'], is_num=True))
            cells.append(make_cell(f'F{row_idx}', s_date, r['start'], is_date=True))
            cells.append(make_cell(f'G{row_idx}', s_date, r['finish'], is_date=True))
            cells.append(make_cell(f'H{row_idx}', s_num, r['estimate'], is_num=True))
            cells.append(make_cell(f'I{row_idx}', s_num, r['effort'], is_num=True))
            cells.append(make_cell(f'J{row_idx}', s_text, r['details']))
            cells.append(make_cell(f'K{row_idx}', s_text, r.get('days_overdue', '')))
            cells.append(make_cell(f'L{row_idx}', s_text, r['priority']))

        new_rows_xml.append(f'<row r="{row_idx}">' + ''.join(cells) + '</row>')
        row_idx += 1

    # =========================================================
    # PROCESS SHEET XML & HEADERS
    # =========================================================
    sheet_path = os.path.join(temp_dir, 'xl', 'worksheets', 'sheet1.xml')
    with open(sheet_path, 'r', encoding='utf-8') as f:
        sheet1_xml = f.read()

    m = re.search(r'(<row[^>]*r="1"[^>]*>.*?</row>)', sheet1_xml, flags=re.DOTALL)
    row1_str = m.group(1) if m else ''

    # Inject Priority column header to L1
    priority_idx = get_string_index("Độ ưu tiên")
    l1_cell = f'<c r="L1" s="20" t="s"><v>{priority_idx}</v></c>'
    row1_str = re.sub(r'spans="1:11"', 'spans="1:12"', row1_str)
    row1_str = row1_str.replace('</row>', l1_cell + '</row>')

    # Change C1 column header to "Người được giao"
    assignee_header_idx = get_string_index("Người được giao")
    row1_str = re.sub(r'<c r="C1" s="20" t="s"><v>\d+</v></c>', f'<c r="C1" s="20" t="s"><v>{assignee_header_idx}</v></c>', row1_str)

    # Change K1 column header to "Ngày trễ"
    ngay_tre_idx = get_string_index("Ngày trễ")
    row1_str = re.sub(r'<c r="K1"[^/]*/>', f'<c r="K1" s="20" t="s"><v>{ngay_tre_idx}</v></c>', row1_str)
    row1_str = re.sub(r'<c r="K1" s="\d+" t="s"><v>\d+</v></c>', f'<c r="K1" s="20" t="s"><v>{ngay_tre_idx}</v></c>', row1_str)

    # Save shared strings
    new_si_block = ''.join(new_si_list)
    sst_xml = sst_xml.replace('</sst>', new_si_block + '</sst>')
    total_count = next_str_idx
    sst_xml = re.sub(
        r'(<sst[^>]+\s)count="[^"]*"',
        lambda m: m.group(0).replace(re.search(r'count="[^"]*"', m.group(0)).group(0), f'count="{total_count}"'),
        sst_xml
    )
    sst_xml = re.sub(
        r'(<sst[^>]+\s)uniqueCount="[^"]*"',
        lambda m: m.group(0).replace(re.search(r'uniqueCount="[^"]*"', m.group(0)).group(0), f'uniqueCount="{total_count}"'),
        sst_xml
    )

    with open(sst_path, 'w', encoding='utf-8') as f:
        f.write(sst_xml)

    # Write sheet data
    new_sheetData = f'<sheetData>{row1_str}' + ''.join(new_rows_xml) + '</sheetData>'
    sheet1_xml = re.sub(
        r'<sheetData\b[^>]*>.*?</sheetData>',
        new_sheetData,
        sheet1_xml,
        flags=re.DOTALL
    )

    # Update dimensions
    sheet1_xml = re.sub(
        r'<dimension ref="[^"]*"/>',
        f'<dimension ref="A1:L{row_idx - 1}"/>',
        sheet1_xml
    )

    with open(sheet_path, 'w', encoding='utf-8') as f:
        f.write(sheet1_xml)

    # styles.xml processed earlier

    # =========================================================
    # REMOVE CALCCHAIN SAFELY
    # =========================================================
    rels_path = os.path.join(temp_dir, 'xl', '_rels', 'workbook.xml.rels')
    if os.path.exists(rels_path):
        with open(rels_path, 'r', encoding='utf-8') as f:
            rels_xml = f.read()
        rels_xml = re.sub(r'<Relationship[^>]*Target="calcChain\.xml"[^>]*/>', '', rels_xml)
        with open(rels_path, 'w', encoding='utf-8') as f:
            f.write(rels_xml)

    ct_path = os.path.join(temp_dir, '[Content_Types].xml')
    if os.path.exists(ct_path):
        with open(ct_path, 'r', encoding='utf-8') as f:
            ct_xml = f.read()
        ct_xml = re.sub(r'<Override[^>]*PartName="/xl/calcChain\.xml"[^>]*/>', '', ct_xml)
        with open(ct_path, 'w', encoding='utf-8') as f:
            f.write(ct_xml)

    # =========================================================
    # CREATE OUTPUT XLSX
    # =========================================================
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for root_dir, dirs, files in os.walk(temp_dir):
            for file in files:
                if file == 'calcChain.xml':
                    continue
                file_path = os.path.join(root_dir, file)
                arcname = os.path.relpath(file_path, temp_dir)
                zout.write(file_path, arcname)

    shutil.rmtree(temp_dir)
    print('SUCCESS')


if __name__ == '__main__':
    input_json = sys.argv[1]
    template_xlsx = sys.argv[2]
    output_xlsx = sys.argv[3]
    process(input_json, template_xlsx, output_xlsx)
