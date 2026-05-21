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

    tasks = data.get('tasks', [])
    columns = data.get('columns', [])

    # =========================================================
    # BUILD ROW DATA
    # =========================================================
    rows = []
    
    # Sort all tasks by column order then task order, or just use the tasks array as is
    # The user wants tasks as main items, checklist items as sub items
    tasks.sort(key=lambda x: (
        columns.index(next((c for c in columns if c.get('id') == x.get('status')), None)) if next((c for c in columns if c.get('id') == x.get('status')), None) in columns else 999,
        x.get('order', 0)
    ))

    st_map = {'todo': 'To Do', 'inprogress': 'In Progress', 'done': 'Done', 'cancel': 'Cancel', 'in-progress': 'In Progress'}

    main_idx = 1
    for t in tasks:
        t_st = st_map.get(t.get('status', ''), t.get('status', ''))
        
        priority_map = {'low': 'Low', 'medium': 'Medium', 'high': 'High', 'urgent': 'Urgent'}
        prio = priority_map.get(t.get('priority', 'medium'), t.get('priority', ''))
        
        checklist = t.get('checklist', [])
        
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
        
        assignee_names = ", ".join([a.get('name', '') for a in t.get('assignees') or [] if a.get('name')])
        
        rows.append({
            'isGroup': True,  # Task is now the main group
            'wbs': str(main_idx),
            'title': t.get('title', ''),
            'status': t_st,
            'percent': str(t_pct),
            'start': format_date_serial(t.get('startDate')),
            'finish': format_date_serial(t.get('deadline')),
            'estimate': str(t.get('estimatedHours', '')) if t.get('estimatedHours') else '',
            'effort': t_effort,
            'details': t.get('description', '') or '',
            'priority': prio,
            'assignees': assignee_names
        })
        
        if checklist:
            for i, c in enumerate(checklist):
                c_st = st_map.get(c.get('status', ''), c.get('status', ''))
                c_pct = 1 if c_st == 'Done' else (0.5 if c_st == 'In Progress' else 0)
                rows.append({
                    'isGroup': False,
                    'wbs': f"{main_idx}.{i + 1}",
                    'title': c.get('title', ''),
                    'status': c_st,
                    'percent': str(c_pct),
                    'start': '',
                    'finish': '',
                    'estimate': '',
                    'effort': str(c.get('actualHours', '')) if c.get('actualHours') else '',
                    'details': '',
                    'priority': ''
                })
                
        main_idx += 1

    # =========================================================
    # EXTRACT TEMPLATE
    # =========================================================
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(template_path, 'r') as zin:
        zin.extractall(temp_dir)

    # =========================================================
    # SHARED STRINGS - process via string manipulation (NOT ElementTree)
    # to preserve exact XML declaration: standalone="yes" and double-quotes
    # =========================================================
    sst_path = os.path.join(temp_dir, 'xl', 'sharedStrings.xml')

    with open(sst_path, 'r', encoding='utf-8') as f:
        sst_xml = f.read()

    # Parse existing strings into cache (by reading current <si> tags)
    string_cache = {}
    si_blocks = re.findall(r'<si.*?>.*?</si>', sst_xml, flags=re.DOTALL)
    for idx, si in enumerate(si_blocks):
        # Extract all text fragments from this si (including rich text)
        text_matches = re.findall(r'<t[^>]*>(.*?)</t>', si)
        text = ''.join(text_matches)
        
        # Unescape XML entities to store the raw text in cache
        text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
        
        if text not in string_cache:
            string_cache[text] = idx

    next_str_idx = len(si_blocks)

    # Buffer for new <si> elements to append
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
            st_style = '33' if r['status'] == 'Done' else ('42' if r['status'] == 'In Progress' else '40')
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
            st_style = '33' if r['status'] == 'Done' else ('42' if r['status'] == 'In Progress' else '40')
            cells.append(make_cell(f'A{row_idx}', '30', r['wbs']))
            cells.append(make_cell(f'B{row_idx}', '31', r['title']))
            cells.append(make_cell(f'C{row_idx}', '25', ''))
            cells.append(make_cell(f'D{row_idx}', st_style, r['status']))
            cells.append(make_cell(f'E{row_idx}', '26', r['percent'], is_num=True))
            cells.append(make_cell(f'F{row_idx}', '27', r['start'], is_date=True))
            cells.append(make_cell(f'G{row_idx}', '27', r['finish'], is_date=True))
            cells.append(make_cell(f'H{row_idx}', '28', r['estimate'], is_num=True))
            cells.append(make_cell(f'I{row_idx}', '28', r['effort'], is_num=True))
            cells.append(make_cell(f'J{row_idx}', '29', r['details']))
            cells.append(make_cell(f'K{row_idx}', '29', ''))
            cells.append(make_cell(f'L{row_idx}', '29', r['priority']))

        new_rows_xml.append(f'<row r="{row_idx}">' + ''.join(cells) + '</row>')
        row_idx += 1

    # =========================================================
    # EXTRACT HEADER ROW & INJECT L1 CELL BEFORE SAVING SHARED STRINGS
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

    # Change C1 column header from Env Version to Người được giao
    assignee_header_idx = get_string_index("Người được giao")
    row1_str = re.sub(r'<c r="C1" s="20" t="s"><v>\d+</v></c>', f'<c r="C1" s="20" t="s"><v>{assignee_header_idx}</v></c>', row1_str)

    # =========================================================
    # WRITE SHARED STRINGS - via string manipulation to keep exact XML declaration
    # =========================================================
    # Append new <si> elements before closing </sst>
    new_si_block = ''.join(new_si_list)
    sst_xml = sst_xml.replace('</sst>', new_si_block + '</sst>')

    # Update count & uniqueCount in the <sst ...> opening tag
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

    # =========================================================
    # PROCESS SHEET XML - via string manipulation (preserve original XML declaration)
    # =========================================================
    new_sheetData = f'<sheetData>{row1_str}' + ''.join(new_rows_xml) + '</sheetData>'

    sheet1_xml = re.sub(
        r'<sheetData\b[^>]*>.*?</sheetData>',
        new_sheetData,
        sheet1_xml,
        flags=re.DOTALL
    )

    # Update dimension
    sheet1_xml = re.sub(
        r'<dimension ref="[^"]*"/>',
        f'<dimension ref="A1:L{row_idx - 1}"/>',
        sheet1_xml
    )

    with open(sheet_path, 'w', encoding='utf-8') as f:
        f.write(sheet1_xml)

    # =========================================================
    # REMOVE CALCCHAIN SAFELY (file + rels + Content_Types)
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
