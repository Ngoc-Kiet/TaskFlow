import sys
import json
import zipfile
import shutil
import tempfile
import os
import re
from datetime import datetime, timedelta


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
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]', '', str(s))
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def get_current_week_range():
    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def should_include_task(task, week_start, week_end):
    status = task.get('status', '')
    task_date_str = task.get('deadline') or task.get('startDate')
    if not task_date_str:
        return status not in ['done', 'cancel']
    try:
        dt = datetime.fromisoformat(task_date_str.replace('Z', '+00:00'))
        task_date = dt.date()
        if week_start <= task_date <= week_end:
            return True
        if task_date < week_start:
            return status not in ['done', 'cancel']
        return True
    except Exception:
        return True


def process(input_json_path, template_path, output_path):
    with open(input_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    projects_data = data.get('projects', [])
    rows = []

    st_map = {'todo': 'To Do', 'inprogress': 'In Progress', 'done': 'Done', 'cancel': 'Cancel', 'in-progress': 'In Progress', 'pending': 'Pending'}
    priority_map = {'low': 'Low', 'medium': 'Medium', 'high': 'High', 'urgent': 'Urgent'}

    def get_is_overdue(task):
        if task.get('status') in ['done', 'cancel', 'pending']:
            return False
        dl = task.get('deadline')
        if not dl:
            return False
        try:
            dl_dt = datetime.fromisoformat(dl.replace('Z', '+00:00'))
            return dl_dt < datetime.now(tz=dl_dt.tzinfo)
        except Exception:
            return False

    def get_is_approaching(task):
        if task.get('status') in ['done', 'cancel', 'pending']:
            return False
        dl = task.get('deadline')
        if not dl:
            return False
        try:
            dl_dt = datetime.fromisoformat(dl.replace('Z', '+00:00'))
            now = datetime.now(tz=dl_dt.tzinfo)
            if dl_dt <= now:
                return False
            return (dl_dt - now).days <= 3
        except Exception:
            return False

    priority_sort = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3}
    status_sort = {'todo': 0, 'inprogress': 1, 'in-progress': 1, 'pending': 2, 'done': 3, 'cancel': 99}

    assignee_stats = {}
    total_stats = {'tasks': 0, 'overdue': 0, 'approaching': 0,
                   'inprogress': 0, 'pending': 0, 'done': 0, 'cancel': 0, 'todo': 0, 'pct_sum': 0.0}

    week_start, week_end = get_current_week_range()

    main_idx = 1
    for proj in projects_data:
        proj_name = proj.get('name', 'Dự án không tên')
        proj_tasks = [t for t in proj.get('tasks', []) if should_include_task(t, week_start, week_end)]
        if not proj_tasks:
            continue

        # Sắp xếp: task trễ hạn lên đầu, cancel xuống cuối, rồi theo độ ưu tiên, rồi theo trạng thái
        proj_tasks.sort(key=lambda x: (
            0 if get_is_overdue(x) else 1,
            1 if x.get('status') == 'cancel' else 0,
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
                    total_pct += (1 if c_st == 'Done' else (0.5 if c_st == 'In Progress' else 0))
                    try:
                        total_effort += float(c.get('actualHours', 0) or 0)
                    except ValueError:
                        pass
                t_pct = total_pct / len(checklist)
                t_effort = str(total_effort) if total_effort > 0 else ''
            else:
                t_pct = 1 if t_st == 'Done' else (0.5 if t_st == 'In Progress' else 0)
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

            raw_assignees = [a.get('name', '') for a in t.get('assignees') or [] if a.get('name')]
            assignee_names = ", ".join(raw_assignees)

            # Xác định task quá hạn / sắp trễ
            is_overdue = get_is_overdue(t)
            is_approaching = False if is_overdue else get_is_approaching(t)
            deadline_note_val = ''
            if is_overdue:
                try:
                    dl_dt = datetime.fromisoformat(t.get('deadline').replace('Z', '+00:00'))
                    days = (datetime.now(tz=dl_dt.tzinfo) - dl_dt).days
                    deadline_note_val = f"+{days} ngày" if days > 0 else "+<1 ngày"
                except Exception:
                    deadline_note_val = 'Trễ'
            elif is_approaching:
                try:
                    dl_dt = datetime.fromisoformat(t.get('deadline').replace('Z', '+00:00'))
                    days = (dl_dt - datetime.now(tz=dl_dt.tzinfo)).days
                    deadline_note_val = f"Còn {days} ngày" if days > 0 else "Hôm nay!"
                except Exception:
                    deadline_note_val = 'Sắp trễ'
            elif t.get('status') == 'pending':
                deadline_note_val = t.get('pendingReason', '') or ''

            title_val = f"⚠ {t.get('title', '')}" if is_overdue else t.get('title', '')
            if not assignee_names:
                assignee_names = "⚠ Chưa phân công"

            desc = t.get('description', '') or ''

            # Thống kê theo người thực hiện
            for a_name in (raw_assignees if raw_assignees else ['Chưa phân công']):
                if a_name not in assignee_stats:
                    assignee_stats[a_name] = {'total': 0, 'overdue': 0, 'approaching': 0,
                                              'inprogress': 0, 'pending': 0, 'done': 0, 'cancel': 0, 'todo': 0}
                s = assignee_stats[a_name]
                s['total'] += 1
                if is_overdue: s['overdue'] += 1
                if is_approaching: s['approaching'] += 1
                if t_st == 'Done': s['done'] += 1
                elif t_st == 'Cancel': s['cancel'] += 1
                elif t_st == 'Pending': s['pending'] += 1
                elif t_st == 'In Progress': s['inprogress'] += 1
                else: s['todo'] += 1

            # Thống kê tổng
            total_stats['tasks'] += 1
            if is_overdue: total_stats['overdue'] += 1
            if is_approaching: total_stats['approaching'] += 1
            if t_st == 'Done': total_stats['done'] += 1
            elif t_st == 'Cancel': total_stats['cancel'] += 1
            elif t_st == 'Pending': total_stats['pending'] += 1
            elif t_st == 'In Progress': total_stats['inprogress'] += 1
            else: total_stats['todo'] += 1
            total_stats['pct_sum'] += t_pct

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
                'details': desc,
                'priority': prio,
                'assignees': assignee_names,
                'checklist': checklist,
                'is_overdue': is_overdue,
                'is_approaching': is_approaching,
                'deadline_note': deadline_note_val
            })
            task_idx += 1

        proj_pct = total_proj_pct / len(proj_tasks) if proj_tasks else 0

        # Tính thống kê cho dòng tóm tắt dự án
        overdue_cnt = sum(1 for tr in task_rows if tr.get('is_overdue'))
        approaching_cnt = sum(1 for tr in task_rows if tr.get('is_approaching'))
        inprogress_cnt = sum(1 for tr in task_rows if tr['status'] == 'In Progress')
        done_cnt = sum(1 for tr in task_rows if tr['status'] == 'Done')
        todo_cnt = sum(1 for tr in task_rows if tr['status'] == 'To Do')
        pending_cnt = sum(1 for tr in task_rows if tr['status'] == 'Pending')
        summary_parts = [f"{len(proj_tasks)} task"]
        if overdue_cnt:
            summary_parts.append(f"{overdue_cnt} trễ hạn 🔴")
        if approaching_cnt:
            summary_parts.append(f"{approaching_cnt} sắp trễ ⚠")
        if inprogress_cnt:
            summary_parts.append(f"{inprogress_cnt} đang làm")
        if pending_cnt:
            summary_parts.append(f"{pending_cnt} tạm dừng")
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
            'status': 'Done' if proj_pct == 1 else ('In Progress' if proj_pct > 0 else 'To Do'),
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
                    c_pct = 1 if c_st == 'Done' else (0.5 if c_st == 'In Progress' else 0)
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
    # GRAND TOTAL ROW (dòng tổng kết đầu report)
    # =========================================================
    overall_pct = (total_stats['pct_sum'] / total_stats['tasks']) if total_stats['tasks'] > 0 else 0.0
    total_projects = sum(1 for p in projects_data if p.get('tasks'))
    total_parts = [f"{total_projects} dự án", f"{total_stats['tasks']} task"]
    if total_stats['overdue']:
        total_parts.append(f"{total_stats['overdue']} trễ hạn 🔴")
    if total_stats['approaching']:
        total_parts.append(f"{total_stats['approaching']} sắp trễ ⚠")
    if total_stats['inprogress']:
        total_parts.append(f"{total_stats['inprogress']} đang làm")
    if total_stats['pending']:
        total_parts.append(f"{total_stats['pending']} tạm dừng")
    if total_stats['done']:
        total_parts.append(f"{total_stats['done']} hoàn thành")
    rows.insert(0, {
        'isGroup': True,
        'wbs': '',
        'title': '📊 TỔNG KẾT',
        'status': 'In Progress' if total_stats['inprogress'] > 0 else ('Done' if total_stats['todo'] == 0 and total_stats['inprogress'] == 0 else 'To Do'),
        'percent': str(overall_pct),
        'start': '',
        'finish': '',
        'estimate': '',
        'effort': '',
        'details': " | ".join(total_parts),
        'priority': '',
        'assignees': '',
        'is_overdue': False
    })

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
    st_pending_idx = '89'
    ap_left_idx = '90'
    ap_center_idx = '91'
    ap_date_idx = '92'

    styles_path = os.path.join(temp_dir, 'xl', 'styles.xml')
    if os.path.exists(styles_path):
        with open(styles_path, 'r', encoding='utf-8') as f:
            styles_xml = f.read()

        # 1. Chèn fonts: overdue + 5 badge fonts (done/inprog/todo/cancel/pending)
        fontId_new = 33
        fontId_badge_done = 34
        fontId_badge_inprog = 35
        fontId_badge_todo = 36
        fontId_badge_cancel = 37
        fontId_badge_pending = 38
        m_fonts = re.search(r'<fonts\s+count="(\d+)"', styles_xml)
        if m_fonts:
            fonts_count = int(m_fonts.group(1))
            fontId_new = fonts_count
            fontId_badge_done = fonts_count + 1
            fontId_badge_inprog = fonts_count + 2
            fontId_badge_todo = fonts_count + 3
            fontId_badge_cancel = fonts_count + 4
            fontId_badge_pending = fonts_count + 5
            new_fonts_count = fonts_count + 6
            styles_xml = re.sub(r'<fonts\s+count="\d+"', f'<fonts count="{new_fonts_count}"', styles_xml, count=1)
            new_fonts = (
                '<font><sz val="10"/><color rgb="FF9C0006"/><name val="Times New Roman"/><family val="1"/></font>'
                '<font><b/><sz val="10"/><color rgb="FF16A34A"/><name val="Times New Roman"/><family val="1"/></font>'
                '<font><b/><sz val="10"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>'
                '<font><b/><sz val="10"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>'
                '<font><sz val="10"/><color rgb="FF64748B"/><name val="Times New Roman"/><family val="1"/></font>'
                '<font><b/><sz val="10"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>'
            )
            styles_xml = styles_xml.replace('</fonts>', new_fonts + '</fonts>', 1)

        # 2. Chèn fills: overdue/pending/approaching + 3 badge fills (done/inprog/todo)
        fillId_new = 16
        fillId_pending = 17
        fillId_approaching = 18
        fillId_badge_done = 19
        fillId_badge_inprog = 20
        fillId_badge_todo = 21
        m_fills = re.search(r'<fills\s+count="(\d+)"', styles_xml)
        if m_fills:
            fills_count = int(m_fills.group(1))
            fillId_new = fills_count
            fillId_pending = fills_count + 1
            fillId_approaching = fills_count + 2
            fillId_badge_done = fills_count + 3
            fillId_badge_inprog = fills_count + 4
            fillId_badge_todo = fills_count + 5
            new_fills_count = fills_count + 6
            styles_xml = re.sub(r'<fills\s+count="\d+"', f'<fills count="{new_fills_count}"', styles_xml, count=1)
            new_fills = (
                '<fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill>'
                '<fill><patternFill patternType="solid"><fgColor rgb="FFFFB347"/><bgColor indexed="64"/></patternFill></fill>'
                '<fill><patternFill patternType="solid"><fgColor rgb="FFFFEB9C"/><bgColor indexed="64"/></patternFill></fill>'
                '<fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>'
                '<fill><patternFill patternType="solid"><fgColor rgb="FFFFD966"/><bgColor indexed="64"/></patternFill></fill>'
                '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>'
            )
            styles_xml = styles_xml.replace('</fills>', new_fills + '</fills>', 1)

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
            st_pending_idx = str(xfs_count + 14)
            ap_left_idx = str(xfs_count + 15)
            ap_center_idx = str(xfs_count + 16)
            ap_date_idx = str(xfs_count + 17)
            new_xfs_count = xfs_count + 18
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
            # Status badge (chỉ cột D): palette hiện đại — nền pastel + chữ đậm màu tương ứng
            style_st_done = f'<xf numFmtId="0" fontId="{fontId_badge_done}" fillId="{fillId_badge_done}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_st_inprog = f'<xf numFmtId="0" fontId="{fontId_badge_inprog}" fillId="{fillId_badge_inprog}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_st_todo = f'<xf numFmtId="0" fontId="{fontId_badge_todo}" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_st_cancel = f'<xf numFmtId="0" fontId="{fontId_badge_cancel}" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_st_pending = f'<xf numFmtId="0" fontId="{fontId_badge_pending}" fillId="{fillId_pending}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            # Approaching styles (nền vàng nhạt)
            style_ap_left = f'<xf numFmtId="0" fontId="12" fillId="{fillId_approaching}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'
            style_ap_center = f'<xf numFmtId="0" fontId="12" fillId="{fillId_approaching}" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            style_ap_date = f'<xf numFmtId="164" fontId="15" fillId="{fillId_approaching}" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            all_new_styles = (style_status_overdue + style_finish_overdue + style_ov_left + style_ov_pct + style_ov_num
                              + style_ws_assignees + style_ws_pct + style_ws_date + style_ws_num + style_ws_text
                              + style_st_done + style_st_inprog + style_st_todo + style_st_cancel + style_st_pending
                              + style_ap_left + style_ap_center + style_ap_date)
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
        val = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]', '', str(val))
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
            if r['status'] == 'Done':
                st_style = st_done_idx
            elif r['status'] == 'In Progress':
                st_style = st_inprog_idx
            elif r['status'] == 'Cancel':
                st_style = st_cancel_idx
            elif r['status'] == 'Pending':
                st_style = st_pending_idx
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
            is_ap = r.get('is_approaching', False)
            if is_ov:
                s_wbs = ov_left_style_idx
                s_title = ov_left_style_idx
                s_assignees = status_overdue_style
                s_status = status_overdue_style
                s_pct = ov_pct_style_idx
                s_date = finish_overdue_style
                s_num = ov_num_style_idx
                s_text = ov_left_style_idx
            elif is_ap:
                s_wbs = ap_left_idx
                s_title = ap_left_idx
                s_assignees = ap_center_idx
                s_pct = ap_center_idx
                s_date = ap_date_idx
                s_num = ap_center_idx
                s_text = ap_left_idx
                if r['status'] == 'Done':
                    s_status = st_done_idx
                elif r['status'] == 'In Progress':
                    s_status = st_inprog_idx
                elif r['status'] == 'Cancel':
                    s_status = st_cancel_idx
                elif r['status'] == 'Pending':
                    s_status = st_pending_idx
                else:
                    s_status = st_todo_idx
            else:
                s_wbs = '30'
                s_title = '31'
                s_assignees = ws_assignees_idx
                s_pct = ws_pct_idx
                s_date = ws_date_idx
                s_num = ws_num_idx
                s_text = ws_text_idx
                if r['status'] == 'Done':
                    s_status = st_done_idx
                elif r['status'] == 'In Progress':
                    s_status = st_inprog_idx
                elif r['status'] == 'Cancel':
                    s_status = st_cancel_idx
                elif r['status'] == 'Pending':
                    s_status = st_pending_idx
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
            cells.append(make_cell(f'K{row_idx}', s_text, r.get('deadline_note', '')))
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

    # Change K1 column header to "Ghi chú"
    ngay_tre_idx = get_string_index("Ghi chú")
    row1_str = re.sub(r'<c r="K1"[^/]*/>', f'<c r="K1" s="20" t="s"><v>{ngay_tre_idx}</v></c>', row1_str)
    row1_str = re.sub(r'<c r="K1" s="\d+" t="s"><v>\d+</v></c>', f'<c r="K1" s="20" t="s"><v>{ngay_tre_idx}</v></c>', row1_str)

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
    # CREATE SHEET2 — Thống kê theo người thực hiện
    # =========================================================
    sorted_assignees = sorted(
        [(k, v) for k, v in assignee_stats.items() if k != 'Chưa phân công'],
        key=lambda x: (-x[1]['overdue'], -x[1]['total'], x[0])
    )
    if 'Chưa phân công' in assignee_stats:
        sorted_assignees.append(('Chưa phân công', assignee_stats['Chưa phân công']))

    headers_s2 = ['Người thực hiện', 'Tổng', 'Trễ hạn 🔴', 'Sắp trễ ⚠', 'Đang làm', 'Tạm dừng', 'Hoàn thành', '% Xong']
    cols_s2 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    rows_s2_xml = []
    hdr_cells = ''.join(f'<c r="{col}1" s="20" t="s"><v>{get_string_index(h)}</v></c>'
                        for col, h in zip(cols_s2, headers_s2))
    rows_s2_xml.append(f'<row r="1">{hdr_cells}</row>')

    for ri, (name, s) in enumerate(sorted_assignees, start=2):
        active = s['total'] - s['cancel']
        pct = s['done'] / active if active > 0 else 0.0
        ov_s = status_overdue_style if s['overdue'] > 0 else ws_num_idx
        ap_s = ap_center_idx if s['approaching'] > 0 else ws_num_idx
        pd_s = st_pending_idx if s['pending'] > 0 else ws_num_idx
        cells_s2 = [
            make_cell(f'A{ri}', ws_text_idx, name),
            make_cell(f'B{ri}', ws_num_idx, str(s['total']), is_num=True),
            make_cell(f'C{ri}', ov_s, str(s['overdue']), is_num=True),
            make_cell(f'D{ri}', ap_s, str(s['approaching']), is_num=True),
            make_cell(f'E{ri}', ws_num_idx, str(s['inprogress']), is_num=True),
            make_cell(f'F{ri}', pd_s, str(s['pending']), is_num=True),
            make_cell(f'G{ri}', ws_num_idx, str(s['done']), is_num=True),
            make_cell(f'H{ri}', ws_pct_idx, str(pct), is_num=True),
        ]
        rows_s2_xml.append(f'<row r="{ri}">{"".join(cells_s2)}</row>')

    # Save shared strings — MUST be after all get_string_index calls (sheet1 + sheet2)
    new_si_block = ''.join(new_si_list)
    sst_xml = sst_xml.replace('</sst>', new_si_block + '</sst>')
    total_count = next_str_idx
    def _patch_sst_tag(m):
        tag = m.group(0)
        tag = re.sub(r'\bcount="[^"]*"', f'count="{total_count}"', tag)
        tag = re.sub(r'\buniqueCount="[^"]*"', f'uniqueCount="{total_count}"', tag)
        return tag
    sst_xml = re.sub(r'<sst\b[^>]*>', _patch_sst_tag, sst_xml, count=1)
    with open(sst_path, 'w', encoding='utf-8') as f:
        f.write(sst_xml)

    last_row_s2 = max(len(sorted_assignees) + 1, 2)
    sheet2_content = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="A1:H{last_row_s2}"/>'
        '<sheetViews><sheetView tabSelected="0" workbookViewId="0">'
        '<selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>'
        '<sheetFormatPr defaultRowHeight="15"/>'
        '<cols>'
        '<col min="1" max="1" width="28" customWidth="1"/>'
        '<col min="2" max="8" width="13" customWidth="1"/>'
        '</cols>'
        '<sheetData>' + ''.join(rows_s2_xml) + '</sheetData>'
        '</worksheet>'
    )
    sheet2_path = os.path.join(temp_dir, 'xl', 'worksheets', 'sheet2.xml')
    with open(sheet2_path, 'w', encoding='utf-8') as f:
        f.write(sheet2_content)

    # Đăng ký sheet2 trong workbook.xml.rels
    if os.path.exists(rels_path):
        with open(rels_path, 'r', encoding='utf-8') as f:
            rels_xml2 = f.read()
        max_rid = max((int(m.group(1)) for m in re.finditer(r'Id="rId(\d+)"', rels_xml2)), default=0)
        new_rid = f"rId{max_rid + 1}"
        sheet2_rel = (f'<Relationship Id="{new_rid}" '
                      f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
                      f'Target="worksheets/sheet2.xml"/>')
        rels_xml2 = rels_xml2.replace('</Relationships>', sheet2_rel + '</Relationships>')
        with open(rels_path, 'w', encoding='utf-8') as f:
            f.write(rels_xml2)

    # Đăng ký sheet2 trong workbook.xml
    wb_path = os.path.join(temp_dir, 'xl', 'workbook.xml')
    if os.path.exists(wb_path):
        with open(wb_path, 'r', encoding='utf-8') as f:
            wb_xml = f.read()
        max_sid = max((int(m.group(1)) for m in re.finditer(r'sheetId="(\d+)"', wb_xml)), default=1)
        sheet2_entry = f'<sheet name="Thống kê theo người" sheetId="{max_sid + 1}" r:id="{new_rid}"/>'
        wb_xml = wb_xml.replace('</sheets>', sheet2_entry + '</sheets>')
        with open(wb_path, 'w', encoding='utf-8') as f:
            f.write(wb_xml)

    # Đăng ký sheet2 trong [Content_Types].xml
    if os.path.exists(ct_path):
        with open(ct_path, 'r', encoding='utf-8') as f:
            ct_xml2 = f.read()
        sheet2_ct = '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        ct_xml2 = ct_xml2.replace('</Types>', sheet2_ct + '</Types>')
        with open(ct_path, 'w', encoding='utf-8') as f:
            f.write(ct_xml2)

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
