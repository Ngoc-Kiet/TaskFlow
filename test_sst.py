import zipfile, re

with zipfile.ZipFile('backend/src/utils/template.xlsx', 'r') as zin:
    sst_xml = zin.read('xl/sharedStrings.xml').decode('utf-8')

si_blocks = re.findall(r'<si.*?>.*?</si>', sst_xml, flags=re.DOTALL)
print(f'Total SI blocks: {len(si_blocks)}')
for i in range(10):
    if i < len(si_blocks):
        text_matches = re.findall(r'<t[^>]*>(.*?)</t>', si_blocks[i])
        text = ''.join(text_matches)
        print(f'{i}: {text}')
