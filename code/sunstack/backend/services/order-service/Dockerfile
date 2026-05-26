FROM python:3.11-slim

WORKDIR /app

COPY services/order-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Shared libs
COPY libs ./backend/libs

# Service code
COPY services/order-service ./

EXPOSE 8004

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
