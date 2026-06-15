-- Backfill condition_category for all family_history rows using the expanded normalization rules.
-- New categories: stroke, arrhythmia, hypercholesterolemia, ovarian_cancer, endometrial_cancer,
--   pancreatic_cancer, melanoma, lung_cancer, alzheimer.
-- Also fixes existing records where ictus was incorrectly stored as cardiovascular_disease.
UPDATE public.family_history SET condition_category =
  CASE
    WHEN LOWER(condition) ~ '(ictus|stroke)'               THEN 'stroke'
    WHEN LOWER(condition) ~ '(fibrillaz|aritmia)'          THEN 'arrhythmia'
    WHEN LOWER(condition) ~ '(ovaio|ovarico)'              THEN 'ovarian_cancer'
    WHEN LOWER(condition) ~ '(pancrea)'                    THEN 'pancreatic_cancer'
    WHEN LOWER(condition) ~ '(endometrio|uterina|utero)'   THEN 'endometrial_cancer'
    WHEN LOWER(condition) ~ '(melanoma|cutaneo)'           THEN 'melanoma'
    WHEN LOWER(condition) ~ '(polmone|polmonare)'          THEN 'lung_cancer'
    WHEN LOWER(condition) ~ '(alzheimer|demenz)'           THEN 'alzheimer'
    WHEN LOWER(condition) ~ '(colesterol|ipercolesterol)'  THEN 'hypercholesterolemia'
    WHEN LOWER(condition) ~ '(infarto|cardio|coronar|bypass|cardiovasc|angina|cuore)' THEN 'cardiovascular_disease'
    WHEN LOWER(condition) ~ '(diabet)'                     THEN 'diabetes'
    WHEN LOWER(condition) ~ '(pressione|ipertens)'         THEN 'hypertension'
    WHEN LOWER(condition) ~ '(colon|retto|colorett|intestin|polipo)' THEN 'colorectal_cancer'
    WHEN LOWER(condition) ~ '(seno|mammell)'               THEN 'breast_cancer'
    WHEN LOWER(condition) ~ '(prostata)'                   THEN 'prostate_cancer'
    WHEN LOWER(condition) ~ '(osteoporos)'                 THEN 'osteoporosis'
    ELSE COALESCE(condition_category, 'other')
  END
WHERE true;
