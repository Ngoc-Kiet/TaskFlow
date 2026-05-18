import sys
import json
import zipfile
import shutil
import tempfile
import os
import re
import xml.etree.ElementTree as ET
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
    if not s:
        return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')

def process(input_json_path, template_path, output_path):
    with open(input_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    tasks = data.get('tasks', [])
    columns = data.get('columns', [])
    
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
            names = [a.get('name', '') if isinstance(a, dict) else str(a) for a in assignees]
            
            st_map = {'todo': 'To Do', 'inprogress': 'In Progress', 'done': 'Done'}
            st = st_map.get(t.get('status', ''), t.get('status', ''))
            pct = 1 if st == 'Done' else (0.5 if st == 'In Progress' else 0)
            
            rows.append({
                'isGroup': False,
                'wbs': f"{main_idx}.{i+1}",
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
        
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(template_path, 'r') as zin:
        zin.extractall(temp_dir)
        
    ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    ET.register_namespace('', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    
    # Process Shared Strings
    sst_path = os.path.join(temp_dir, 'xl', 'sharedStrings.xml')
    tree_sst = ET.parse(sst_path)
    root_sst = tree_sst.getroot()
    
    existing_si = list(root_sst.findall(f'{ns}si'))
    string_cache = {}
    next_str_idx = len(existing_si)
    
    def get_string_index(val):
        nonlocal next_str_idx
        if val in string_cache:
            return string_cache[val]
        
        si = ET.SubElement(root_sst, f'{ns}si')
        t = ET.SubElement(si, f'{ns}t')
        t.text = str(val)
        
        idx = next_str_idx
        string_cache[val] = idx
        next_str_idx += 1
        return idx
        
    def make_cell(r_ref, s_idx, val, is_num=False, is_date=False):
        if val == '':
            return f'<c r="{r_ref}" s="{s_idx}"/>'
        if is_num or is_date:
            return f'<c r="{r_ref}" s="{s_idx}"><v>{val}</v></c>'
        else:
            idx = get_string_index(val)
            return f'<c r="{r_ref}" s="{s_idx}" t="s"><v>{idx}</v></c>'

    new_rows_xml = []
    row_idx = 2
    for r in rows:
        cells = []
        if r['isGroup']:
            cells.append(make_cell(f'A{row_idx}', '23', r['wbs'], is_num=True))
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
            
        row_str = f'<row r="{row_idx}">' + "".join(cells) + '</row>'
        new_rows_xml.append(row_str)
        row_idx += 1
        
    # Update Shared Strings count
    total_strings = next_str_idx
    root_sst.attrib['count'] = str(int(root_sst.attrib.get('count', '0')) + len(string_cache))
    root_sst.attrib['uniqueCount'] = str(total_strings)
    tree_sst.write(sst_path, xml_declaration=True, encoding='UTF-8')
    
    # Process sheet1.xml via string replacement
    sheet_path = os.path.join(temp_dir, 'xl', 'worksheets', 'sheet1.xml')
    with open(sheet_path, 'r', encoding='utf-8') as f:
        sheet1_xml = f.read()
        
    m = re.search(r'(<row r="1"[^>]*>.*?</row>)', sheet1_xml, flags=re.DOTALL)
    row1_str = m.group(1) if m else ''
    
    new_sheetData = f'<sheetData>{row1_str}' + "".join(new_rows_xml) + '</sheetData>'
    sheet1_xml = re.sub(r'<sheetData>.*?</sheetData>', new_sheetData, sheet1_xml, flags=re.DOTALL)
    
    sheet1_xml = re.sub(r'<conditionalFormatting[^>]*>.*?</conditionalFormatting>', '', sheet1_xml, flags=re.DOTALL)
    sheet1_xml = re.sub(r'<conditionalFormatting[^>]*/>', '', sheet1_xml)
    sheet1_xml = re.sub(r'<extLst>.*?</extLst>', '', sheet1_xml, flags=re.DOTALL)
    sheet1_xml = re.sub(r'<dimension ref="[^"]+"/>', f'<dimension ref="A1:K{row_idx-1}"/>', sheet1_xml)
    
    with open(sheet_path, 'w', encoding='utf-8') as f:
        f.write(sheet1_xml)
    
    # Write output
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for root_dir, dirs, files in os.walk(temp_dir):
            for file in files:
                if file == 'calcChain.xml':
                    continue
                file_path = os.path.join(root_dir, file)
                arcname = os.path.relpath(file_path, temp_dir)
                zout.write(file_path, arcname)
                
    shutil.rmtree(temp_dir)
    print("SUCCESS")

if __name__ == '__main__':
    input_json = sys.argv[1]
    template_xlsx = sys.argv[2]
    output_xlsx = sys.argv[3]
    process(input_json, template_xlsx, output_xlsx)
