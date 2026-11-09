# # src/ml/model_registry.py
# import mlflow
# from datetime import datetime

# class ModelRegistry:
#     def save_model(self, model, metrics, features, params):
#         with mlflow.start_run():
#             mlflow.log_params(params)
#             mlflow.log_metrics(metrics)
#             mlflow.xgboost.log_model(model, "model")
#             mlflow.log_dict({"features": features}, "features.json")
        
#         return mlflow.active_run().info.run_id
    
#     def load_latest(self):
#         return mlflow.xgboost.load_model("models:/hotspot_predictor/latest")