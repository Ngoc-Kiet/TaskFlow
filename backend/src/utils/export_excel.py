import sys
import json
import zipfile
import xml.etree.ElementTree as ET
import shutil
import tempfile
import os
from datetime import datetime

def format_date_serial(date_str):
    if not date_str:
        return ''
    # Excel serial date: days since 1899-12-30
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
    
    # 1. Group tasks by columns
    rows = []
    main_idx = 1
    
    for col in columns:
        col_tasks = [t for t in tasks if t.get('status') == col.get('id')]
        col_tasks.sort(key=lambda x: x.get('order', 0))
        
        if not col_tasks:
            continue
            
        # Group row
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
        
        # Task rows
        for i, t in enumerate(col_tasks):
            assignees = t.get('assignees', [])
            names = [a.get('name', '') if isinstance(a, dict) else str(a) for a in assignees]
            assignee_str = ', '.join(names)
            
            # Map status
            status_map = {'todo': 'To Do', 'inprogress': 'In Progress', 'done': 'Done'}
            st = status_map.get(t.get('status', ''), t.get('status', ''))
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
        
    # 2. Modify xlsx zip
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(template_path, 'r') as zin:
        zin.extractall(temp_dir)
        
    sheet_path = os.path.join(temp_dir, 'xl', 'worksheets', 'sheet1.xml')
    ET.register_namespace('', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    tree = ET.parse(sheet_path)
    root = tree.getroot()
    ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    
    sheetData = root.find(f'{ns}sheetData')
    
    # Keep row 1, remove others
    row1 = None
    for r in list(sheetData):
        if r.attrib.get('r') == '1':
            row1 = r
        sheetData.remove(r)
        
    if row1 is not None:
        sheetData.append(row1)
        
    # Function to create cell
    def make_cell(r_ref, s_idx, val, is_num=False, is_date=False):
        c = ET.Element(f'{ns}c')
        c.attrib['r'] = r_ref
        if s_idx:
            c.attrib['s'] = s_idx
        if val != '':
            if is_num or is_date:
                v = ET.SubElement(c, f'{ns}v')
                v.text = str(val)
            else:
                c.attrib['t'] = 'inlineStr'
                is_el = ET.SubElement(c, f'{ns}is')
                t_el = ET.SubElement(is_el, f'{ns}t')
                t_el.text = str(val)
        return c

    # Add rows
    row_idx = 2
    for r in rows:
        row_el = ET.Element(f'{ns}row')
        row_el.attrib['r'] = str(row_idx)
        
        if r['isGroup']:
            # Group style indexes based on Row 2 of template
            # A: 23, B: 24, C: 25, D: 33, E: 34, F: 27, G: 27, H: 28, I: 28, J: 29, K: 29
            row_el.append(make_cell(f'A{row_idx}', '23', r['wbs'], is_num=True))
            row_el.append(make_cell(f'B{row_idx}', '24', r['title']))
            row_el.append(make_cell(f'C{row_idx}', '25', ''))
            row_el.append(make_cell(f'D{row_idx}', '24', ''))
            row_el.append(make_cell(f'E{row_idx}', '34', ''))
            row_el.append(make_cell(f'F{row_idx}', '27', ''))
            row_el.append(make_cell(f'G{row_idx}', '27', ''))
            row_el.append(make_cell(f'H{row_idx}', '28', ''))
            row_el.append(make_cell(f'I{row_idx}', '28', ''))
            row_el.append(make_cell(f'J{row_idx}', '29', ''))
            row_el.append(make_cell(f'K{row_idx}', '29', ''))
        else:
            # Task style indexes based on Row 10 of template
            # A: 30, B: 31, C: 25, D: 42 (In Progress), E: 26, F: 27, G: 27, H: 28, I: 28, J: 29, K: 29
            # Status colors: Done=33, In Progress=42, To Do=40 (assume 40 for todo, since we don't know exactly)
            st_style = '33' if r['status'] == 'Done' else ('42' if r['status'] == 'In Progress' else '40')
            
            row_el.append(make_cell(f'A{row_idx}', '30', r['wbs']))
            row_el.append(make_cell(f'B{row_idx}', '31', r['title']))
            row_el.append(make_cell(f'C{row_idx}', '25', ''))
            row_el.append(make_cell(f'D{row_idx}', st_style, r['status']))
            row_el.append(make_cell(f'E{row_idx}', '26', r['percent'], is_num=True))
            row_el.append(make_cell(f'F{row_idx}', '27', r['start'], is_date=True) if r['start'] else make_cell(f'F{row_idx}', '27', ''))
            row_el.append(make_cell(f'G{row_idx}', '27', r['finish'], is_date=True) if r['finish'] else make_cell(f'G{row_idx}', '27', ''))
            row_el.append(make_cell(f'H{row_idx}', '28', r['estimate'], is_num=True) if r['estimate'] else make_cell(f'H{row_idx}', '28', ''))
            row_el.append(make_cell(f'I{row_idx}', '28', r['effort'], is_num=True) if r['effort'] else make_cell(f'I{row_idx}', '28', ''))
            row_el.append(make_cell(f'J{row_idx}', '29', r['details']))
            row_el.append(make_cell(f'K{row_idx}', '29', ''))
            
        sheetData.append(row_el)
        row_idx += 1
        
    # Update dimension
    dim = root.find(f'{ns}dimension')
    if dim is not None:
        dim.attrib['ref'] = f'A1:K{row_idx-1}'
        
    tree.write(sheet_path, xml_declaration=True, encoding='UTF-8')
    
    # Save back to zip
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for root_dir, dirs, files in os.walk(temp_dir):
            for file in files:
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
