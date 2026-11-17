import csv,io,json,urllib.request,urllib.error
from pathlib import Path
base='http://127.0.0.1:8001'
def request(path,data=None,csv_text=None):
    headers={}
    if csv_text is not None:
        boundary='AI4IRegression'
        data=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="case.csv"\r\nContent-Type: text/csv\r\n\r\n'+csv_text+f'\r\n--{boundary}--\r\n').encode()
        headers['Content-Type']='multipart/form-data; boundary='+boundary
    elif data is not None:
        data=json.dumps(data).encode();headers['Content-Type']='application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers=headers)) as res:
            return res.status,json.load(res)
    except urllib.error.HTTPError as e:
        return e.code,json.load(e)
def csv_for(sample):
    output=io.StringIO();writer=csv.DictWriter(output,fieldnames=list(sample));writer.writeheader();writer.writerow(sample);return output.getvalue()
before=json.loads(Path('web_app/prediction-before.json').read_text())
for sample,score in before:
    code,result=request('/api/predict',sample)
    assert code==200,(code,result)
    assert result['model_score']==score,(result['model_score'],score)
    code,batch=request('/api/predict-csv',csv_text=csv_for(sample))
    assert code==200,(code,batch)
    assert batch['rows'][0]['model_score']==score
    assert batch['rows'][0]['is_failure']==result['is_failure']
    if result['out_of_range_warnings']:
        assert result['suggestions'][0]=='Kết quả ngoài phạm vi Train không đủ cơ sở kết luận'
    print('valid equality',result['status_label'],score)
normal=before[0][0]
for key,value in [('Tool wear [min]',-10),('Torque [Nm]',''),('Torque [Nm]','abc'),('Torque [Nm]',float('nan')),('Torque [Nm]',float('inf')),('Torque [Nm]',float('-inf')),('Type','X'),('Type',''),('Air temperature [K]',0),('Process temperature [K]',-1)]:
    sample={**normal,key:value}
    for is_csv in (False,True):
        code,error=request('/api/predict-csv',csv_text=csv_for(sample)) if is_csv else request('/api/predict',sample)
        assert code in (400,422),(sample,code,error)
        if is_csv: assert 'Dòng 2' in error['detail'] and key in error['detail'],error
        if key=='Tool wear [min]': assert 'Độ mòn dao phải từ 0 phút trở lên' in error['detail']
for is_csv in (False,True):
    missing=dict(normal);missing.pop('Torque [Nm]')
    code,error=request('/api/predict-csv',csv_text=csv_for(missing)) if is_csv else request('/api/predict',missing)
    assert code in (400,422)
sample={**normal,'Type':' l '}
assert request('/api/predict',sample)[1]['model_score']==before[0][1]
assert request('/api/predict-csv',csv_text=csv_for(sample))[1]['rows'][0]['model_score']==before[0][1]
code,test=request('/api/test-results');assert code==200,test
assert len(test['pr_curve'])>60
assert test['confusion_matrix']=={'tn':1437,'fp':12,'fn':12,'tp':39}
print('PASS valid parity, normalization, invalid cases, saved metrics, full PR',len(test['pr_curve']))
