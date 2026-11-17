import json
import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline
from sklearn.base import clone
from sklearn.metrics import average_precision_score
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate
from sklearn.preprocessing import StandardScaler

from export_results import export_results
from preprocess import FEATURES, NUMERIC, OUT, TARGET
from model_helpers import MODELS, build_pipeline, choose_threshold, evaluate

STRATEGIES = ('baseline', 'class_weight', 'smotenc_25')
PROFILES = {
    'Logistic Regression': [{'C': .03}, {'C': .3}],
    'Random Forest': MODELS['Random Forest'][1],
    'LightGBM': [
        dict(max_depth=3, num_leaves=7, n_estimators=210, min_child_samples=22, reg_lambda=4),
        dict(max_depth=4, num_leaves=10, n_estimators=175, min_child_samples=24, reg_lambda=4),
        dict(max_depth=4, num_leaves=12, n_estimators=200, min_child_samples=20, reg_lambda=3),
        MODELS['LightGBM'][1][1],
    ],
    'XGBoost': [
        dict(max_depth=3, n_estimators=200, min_child_weight=4, reg_lambda=4),
        dict(max_depth=4, n_estimators=175, min_child_weight=4, reg_lambda=4),
        dict(max_depth=4, n_estimators=200, min_child_weight=3, reg_lambda=3),
        MODELS['XGBoost'][1][1],
    ],
}

def main():
    data = OUT / 'du_lieu'
    train = pd.read_csv(data/'train.csv')
    val = pd.read_csv(data/'validation.csv')
    folds = list(RepeatedStratifiedKFold(n_splits=3, n_repeats=2, random_state=42)
                 .split(train, train[TARGET]))
    rows, fitted = [], []
    for name, profiles in PROFILES.items():
        base = MODELS[name][0]
        for i, params in enumerate(profiles, 1):
            configs = [(method, FEATURES, build_pipeline(name, base, method, params)) for method in STRATEGIES]
            if name in ('LightGBM', 'XGBoost') and i == 2:
                for method in ('numeric_baseline','smote_numeric'):
                    sampler = SMOTE(sampling_strategy=.25,random_state=42) if method=='smote_numeric' else 'passthrough'
                    configs.append((method, NUMERIC, Pipeline([
                        ('scale',StandardScaler()),('sample',sampler),
                        ('model',clone(base).set_params(**params)),
                    ])))
            for method, columns, pipeline in configs:
                scores = cross_validate(pipeline, train[columns], train[TARGET], cv=folds,
                                        scoring='average_precision',return_train_score=True,
                                        error_score='raise')
                pipeline.fit(train[columns],train[TARGET])
                vs = pipeline.predict_proba(val[columns])[:,1]
                threshold, _ = choose_threshold(val[TARGET],vs)
                v = evaluate(val[TARGET], vs,threshold)
                train_ap, test_ap = scores['train_score'],scores['test_score']
                rows.append(dict(model=name, profile=i, method=method, columns=columns,
                                 params=params, train_ap=float(train_ap.mean()), cv_ap=float(test_ap.mean()),
                                 cv_sd=float(test_ap.std(ddof=1)), gap=float((train_ap-test_ap).mean()),
                                 threshold=threshold, val=v))
                fitted.append(pipeline)
            print(name,i,flush=True)
    top_cv=max(row['cv_ap'] for row in rows)
    top_val=max(row['val']['ap'] for row in rows)
    eligible=[i for i,r in enumerate(rows) if r['cv_ap']>=top_cv-.03 and r['val']['ap']>=top_val-.03]
    shortlist=sorted(eligible,key=lambda i:(rows[i]['gap'],rows[i]['cv_sd'],-rows[i]['val']['f1']))
    winner=shortlist[0] if shortlist else max(range(len(rows)),key=lambda i:rows[i]['cv_ap'])
    original=next(i for i,r in enumerate(rows) if r['model']=='LightGBM' and r['params']==MODELS['LightGBM'][1][1] and r['method']=='baseline')
    outcome={'winner':rows[winner],'original':rows[original],'cv_required':top_cv-.03,'val_required':top_val-.03,
             'total':len(rows),'all_configurations':rows,'shortlist':[rows[i] for i in shortlist],
             'method_peaks':{m:max((r for r in rows if r['method']==m),key=lambda r:r['cv_ap'])
                             for m in sorted({r['method'] for r in rows})}}
    # This is the fixed Test from the earlier experiment. It is opened after selection.
    test=pd.read_csv(data/'test.csv')
    for label,i in [('winner',winner),('original',original)]:
        row=rows[i]
        score=fitted[i].predict_proba(test[row['columns']])[:,1]
        outcome[label+'_test']=evaluate(test[TARGET],score,row['threshold'])
    export_results(outcome)
    print(json.dumps({k:outcome[k] for k in ('winner','original','winner_test','original_test','total')},indent=2))

if __name__=='__main__':
    main()
