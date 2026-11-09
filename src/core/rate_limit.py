# # src/core/rate_limit.py
# from slowapi import Limiter, _rate_limit_exceeded_handler
# from slowapi.util import get_remote_address

# limiter = Limiter(key_func=get_remote_address)

# # Në endpoint
# @router.post("/reports")
# @limiter.limit("10/minute")
# async def create_report(...):
#     pass