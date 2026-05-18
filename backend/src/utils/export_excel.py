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
    main_idx = 1

    for col in columns:
        col_tasks = [t for t in tasks if t.get('status') == col.get('id')]
        col_tasks.sort(key=lambda x: x.get('order', 0))

        if not col_tasks:
            continue

        rows.append({
            'isGroup': True,
            'wbs': str(main_idx),
            'title': col.get('title', ''),
            'status': '', 'percent': '', 'start': '', 'finish': '',
            'estimate': '', 'effort': '', 'details': ''
        })

        for i, t in enumerate(col_tasks):
            st_map = {'todo': 'To Do', 'inprogress': 'In Progress', 'done': 'Done'}
            st = st_map.get(t.get('status', ''), t.get('status', ''))
            pct = 1 if st == 'Done' else (0.5 if st == 'In Progress' else 0)

            rows.append({
                'isGroup': False,
                'wbs': f"{main_idx}.{i + 1}",
                'title': t.get('title', ''),
                'status': st,
                'percent': str(pct),
                'start': format_date_serial(t.get('startDate')),
                'finish': format_date_serial(t.get('deadline')),
                'estimate': str(t.get('estimatedHours', '')) if t.get('estimatedHours') else '',
                'effort': str(t.get('actualHours', '')) if t.get('actualHours') else '',
                'details': t.get('description', '') or ''
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
    existing_strings = re.findall(r'<si><t[^>]*>([^<]*)</t></si>', sst_xml)
    # Also handle si with rPh, phoneticPr etc. - just count all <si> tags
    all_si_count = len(re.findall(r'<si>', sst_xml))

    string_cache = {}
    for idx, s in enumerate(existing_strings):
        if s not in string_cache:
            string_cache[s] = idx

    next_str_idx = all_si_count

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
            cells.append(make_cell(f'A{row_idx}', '23', r['wbs']))
            cells.append(make_cell(f'B{row_idx}', '24', r['title']))
            cells.append(make_cell(f'C{row_idx}', '25', ''))
            cells.append(make_cell(f'D{row_idx}', '24', ''))
            cells.append(make_cell(f'E{row_idx}', '34', ''))
            cells.append(make_cell(f'F{row_idx}', '27', ''))
            cells.append(make_cell(f'G{row_idx}', '27', ''))
            cells.append(make_cell(f'H{row_idx}', '28', ''))
            cells.append(make_cell(f'I{row_idx}', '28', ''))
            cells.append(make_cell(f'J{row_idx}', '29', ''))
            cells.append(make_cell(f'K{row_idx}', '29', ''))
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

        new_rows_xml.append(f'<row r="{row_idx}">' + ''.join(cells) + '</row>')
        row_idx += 1

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
    sheet_path = os.path.join(temp_dir, 'xl', 'worksheets', 'sheet1.xml')

    with open(sheet_path, 'r', encoding='utf-8') as f:
        sheet1_xml = f.read()

    # Extract header row
    m = re.search(r'(<row[^>]*r="1"[^>]*>.*?</row>)', sheet1_xml, flags=re.DOTALL)
    row1_str = m.group(1) if m else ''

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
        f'<dimension ref="A1:K{row_idx - 1}"/>',
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
