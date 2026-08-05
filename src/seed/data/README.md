# DrugIQ – Seed Data Directory

Place your Kaggle Drug Reviews CSV files here before running `npm run seed`.

## Expected Files

| Filename                  | Description                 |
|---------------------------|-----------------------------|
| `drugsComTrain_raw.csv`   | Training set (~161K reviews)|
| `drugsComTest_raw.csv`    | Test set (~54K reviews)     |

## Dataset Source

[Drug Review Dataset (Drugs.com) — Kaggle](https://www.kaggle.com/datasets/jessicali9530/kuc-hackathon-winter-2018)

## Column Schema

| Column       | Type    | Description                         |
|--------------|---------|-------------------------------------|
| `drugName`   | string  | Name of the drug                    |
| `condition`  | string  | Patient medical condition           |
| `review`     | string  | Patient review text                 |
| `rating`     | integer | Patient rating (1–10)               |
| `date`       | string  | Date of review                      |
| `usefulCount`| integer | Number of users who found it useful |
