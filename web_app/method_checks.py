import sys,json,io,csv,urllib.request
from pathlib import Path
import pandas as pd
BASE='http://127.0.0.1:8003'
def get(path,payload=None,body=None,content_type=None):
    headers={}
    if payload is not None:
        body=json.dumps(payload).encode();headers['Content-Type']='application/json'
    if content_type: headers['Content-Type']=content_type
    with urllib.request.urlopen(urllib.request.Request(BASE+path,data=body,headers=headers)) as r:return json.load(r)
method=get('/api/methodology')
assert len(method['encoded_features'])==8
for key,filename in [('all','data/ai4i2020.csv'),*[(x,f'ket_qua/du_lieu/{x}.csv') for x in ('train','validation','test')]]:
    frame=pd.read_csv(filename)
    actual=method['distributions'][key]
    assert actual['total']==len(frame)
    assert actual['failures']==int(frame['Machine failure'].sum())
raw=pd.read_csv('data/ai4i2020.csv')
assert method['missing_cells']==int(raw.isna().sum().sum())
assert method['duplicate_rows']==int(raw.duplicated().sum())
cfg=pd.read_csv('ket_qua/thuc_nghiem/so_sanh_40_cau_hinh.csv')
assert ((cfg.train_ap-cfg.cv_ap-cfg.gap).abs()<1e-12).all()
sample_list=get('/api/test-samples')
assert len(sample_list)==1500
saved=pd.read_csv('ket_qua/thuc_nghiem/du_doan_test.csv')
selected={}
for row in sample_list:
    found=saved[saved.UDI==row['id']].iloc[0]
    outcome=('T' if int(found.du_doan_hong)==row['label'] else 'F')+('P' if found.du_doan_hong else 'N')
    if outcome not in selected:selected[outcome]=row
for outcome,row in selected.items():
    assert len(row['inputs'])==6 and 'Machine failure' not in row['inputs']
    result=get(f"/api/test-samples/{row['id']}/predict",body=b'')
    manual=get('/api/predict',row['inputs'])
    out=io.StringIO();writer=csv.DictWriter(out,fieldnames=row['inputs']);writer.writeheader();writer.writerow(row['inputs'])
    boundary='testboundary'
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.csv"\r\nContent-Type: text/csv\r\n\r\n'+out.getvalue()+f'\r\n--{boundary}--\r\n').encode()
    batch=get('/api/predict-csv',body=body,content_type='multipart/form-data; boundary='+boundary)['rows'][0]
    assert result['test_comparison']['outcome']==outcome
    assert abs(result['model_score']-manual['model_score'])<1e-14
    assert abs(result['model_score']-batch['model_score'])<1e-14
    assert result['is_failure']==manual['is_failure']==batch['is_failure']
    archived=saved[saved.UDI==row['id']].iloc[0]
    assert abs(result['model_score']-archived.diem_hong)<1e-12
    print(outcome,row['id'],result['model_score'])
assert len(selected)==4
Path('web_app/method-qa-samples.json').write_text(json.dumps({k:v['id'] for k,v in selected.items()}))
print('PASS source counts, missing/duplicates, pipeline width, Gap definition, all four outcomes, Test/manual/CSV/saved equality')
