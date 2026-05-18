import sys
import json
import zipfile
import shutil
import tempfile
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ns = f'{{{NS}}}'

ET.register_namespace('', NS)


def format_date_serial(date_str):
    if not date_str:
        return ''

    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        delta = dt - datetime(1899, 12, 30, tzinfo=dt.tzinfo)
        return str(delta.days + (delta.seconds / 86400.0))
    except Exception:
        return ''


def process(input_json_path, template_path, output_path):

    with open(input_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tasks = data.get('tasks', [])
    columns = data.get('columns', [])

    rows = []

    main_idx = 1

    # =========================================================
    # BUILD ROW DATA
    # =========================================================

    for col in columns:

        col_tasks = [
            t for t in tasks
            if t.get('status') == col.get('id')
        ]

        col_tasks.sort(key=lambda x: x.get('order', 0))

        if not col_tasks:
            continue

        rows.append({
            'isGroup': True,
            'wbs': str(main_idx),
            'title': col.get('title', ''),
            'status': '',
            'percent': '',
            'start': '',
            'finish': '',
            'estimate': '',
            'effort': '',
            'details': ''
        })

        for i, t in enumerate(col_tasks):

            assignees = t.get('assignees', [])

            names = [
                a.get('name', '') if isinstance(a, dict) else str(a)
                for a in assignees
            ]

            st_map = {
                'todo': 'To Do',
                'inprogress': 'In Progress',
                'done': 'Done'
            }

            st = st_map.get(
                t.get('status', ''),
                t.get('status', '')
            )

            pct = (
                1
                if st == 'Done'
                else (0.5 if st == 'In Progress' else 0)
            )

            rows.append({
                'isGroup': False,
                'wbs': f"{main_idx}.{i + 1}",
                'title': t.get('title', ''),
                'status': st,
                'percent': str(pct),
                'start': format_date_serial(t.get('startDate')),
                'finish': format_date_serial(t.get('deadline')),
                'estimate': str(t.get('estimatedHours', '')),
                'effort': str(t.get('actualHours', '')),
                'details': t.get('description', '')
            })

        main_idx += 1

    # =========================================================
    # EXTRACT TEMPLATE
    # =========================================================

    temp_dir = tempfile.mkdtemp()

    with zipfile.ZipFile(template_path, 'r') as zin:
        zin.extractall(temp_dir)

    # =========================================================
    # SHARED STRINGS
    # =========================================================

    sst_path = os.path.join(
        temp_dir,
        'xl',
        'sharedStrings.xml'
    )

    tree_sst = ET.parse(sst_path)
    root_sst = tree_sst.getroot()

    existing_si = list(root_sst.findall(f'{ns}si'))

    string_cache = {}

    # preload existing strings
    for idx, si in enumerate(existing_si):

        t = si.find(f'{ns}t')

        if t is not None and t.text:
            string_cache[t.text] = idx

    next_str_idx = len(existing_si)

    def get_string_index(val):

        nonlocal next_str_idx

        val = str(val)

        if val in string_cache:
            return string_cache[val]

        si = ET.SubElement(root_sst, f'{ns}si')

        t = ET.SubElement(si, f'{ns}t')

        # preserve spaces
        if val.startswith(' ') or val.endswith(' '):
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')

        t.text = val

        idx = next_str_idx

        string_cache[val] = idx

        next_str_idx += 1

        return idx

    # =========================================================
    # CREATE CELL XML
    # =========================================================

    def make_cell(
            r_ref,
            s_idx,
            val,
            is_num=False,
            is_date=False
    ):

        if val == '' or val is None:
            return f'<c r="{r_ref}" s="{s_idx}"/>'

        if is_num or is_date:
            return (
                f'<c r="{r_ref}" s="{s_idx}" t="n">'
                f'<v>{val}</v>'
                f'</c>'
            )

        idx = get_string_index(str(val))

        return (
            f'<c r="{r_ref}" s="{s_idx}" t="s">'
            f'<v>{idx}</v>'
            f'</c>'
        )

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
            cells.append(make_cell(f'J{row_idx}', '29', r['details']))
            cells.append(make_cell(f'K{row_idx}', '29', ''))

        else:

            st_style = (
                '33'
                if r['status'] == 'Done'
                else (
                    '42'
                    if r['status'] == 'In Progress'
                    else '40'
                )
            )

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

        row_str = (
            f'<row r="{row_idx}">'
            + ''.join(cells)
            + '</row>'
        )

        new_rows_xml.append(row_str)

        row_idx += 1

    # =========================================================
    # FIX SHARED STRINGS COUNTS
    # =========================================================

    all_si = root_sst.findall(f'{ns}si')

    root_sst.set('count', str(len(all_si)))
    root_sst.set('uniqueCount', str(len(all_si)))

    tree_sst.write(
        sst_path,
        xml_declaration=True,
        encoding='UTF-8'
    )

    # =========================================================
    # PROCESS SHEET XML
    # =========================================================

    sheet_path = os.path.join(
        temp_dir,
        'xl',
        'worksheets',
        'sheet1.xml'
    )

    with open(sheet_path, 'r', encoding='utf-8') as f:
        sheet1_xml = f.read()

    # keep header row
    m = re.search(
        r'(<row[^>]*r="1"[^>]*>.*?</row>)',
        sheet1_xml,
        flags=re.DOTALL
    )

    row1_str = m.group(1) if m else ''

    new_sheetData = (
        f'<sheetData>'
        f'{row1_str}'
        + ''.join(new_rows_xml)
        + '</sheetData>'
    )

    # safer sheetData replace
    sheet1_xml = re.sub(
        r'<sheetData\b[^>]*>.*?</sheetData>',
        new_sheetData,
        sheet1_xml,
        flags=re.DOTALL
    )
    
    # remove conditional formatting
    sheet1_xml = re.sub(r'<conditionalFormatting[^>]*>.*?</conditionalFormatting>', '', sheet1_xml, flags=re.DOTALL)
    sheet1_xml = re.sub(r'<conditionalFormatting[^>]*/>', '', sheet1_xml)
    sheet1_xml = re.sub(r'<extLst>.*?</extLst>', '', sheet1_xml, flags=re.DOTALL)

    # update dimension
    sheet1_xml = re.sub(
        r'<dimension ref="[^"]*"/>',
        f'<dimension ref="A1:K{row_idx - 1}"/>',
        sheet1_xml
    )

    # validate xml before save
    try:
        ET.fromstring(sheet1_xml)
    except Exception as e:
        print('INVALID SHEET XML')
        print(e)
        raise

    with open(sheet_path, 'w', encoding='utf-8') as f:
        f.write(sheet1_xml)

    # =========================================================
    # REMOVE CALCCHAIN SAFELY
    # =========================================================

    rels_path = os.path.join(
        temp_dir,
        'xl',
        '_rels',
        'workbook.xml.rels'
    )

    if os.path.exists(rels_path):

        with open(rels_path, 'r', encoding='utf-8') as f:
            rels_xml = f.read()

        rels_xml = re.sub(
            r'<Relationship[^>]*Target="calcChain\.xml"[^>]*/>',
            '',
            rels_xml
        )

        with open(rels_path, 'w', encoding='utf-8') as f:
            f.write(rels_xml)

    ct_path = os.path.join(
        temp_dir,
        '[Content_Types].xml'
    )

    if os.path.exists(ct_path):

        with open(ct_path, 'r', encoding='utf-8') as f:
            ct_xml = f.read()

        ct_xml = re.sub(
            r'<Override[^>]*PartName="/xl/calcChain\.xml"[^>]*/>',
            '',
            ct_xml
        )

        with open(ct_path, 'w', encoding='utf-8') as f:
            f.write(ct_xml)

    # =========================================================
    # CREATE OUTPUT XLSX
    # =========================================================

    with zipfile.ZipFile(
            output_path,
            'w',
            zipfile.ZIP_DEFLATED
    ) as zout:

        for root_dir, dirs, files in os.walk(temp_dir):

            for file in files:

                if file == 'calcChain.xml':
                    continue

                file_path = os.path.join(root_dir, file)

                arcname = os.path.relpath(
                    file_path,
                    temp_dir
                )

                zout.write(file_path, arcname)

    shutil.rmtree(temp_dir)

    print('SUCCESS')


if __name__ == '__main__':

    input_json = sys.argv[1]
    template_xlsx = sys.argv[2]
    output_xlsx = sys.argv[3]

    process(
        input_json,
        template_xlsx,
        output_xlsx
    )
