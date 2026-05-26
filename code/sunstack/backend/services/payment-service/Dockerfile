FROM python:3.11-slim

WORKDIR /app

COPY services/payment-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Shared libs
COPY libs ./backend/libs

# Service code
COPY services/payment-service ./

EXPOSE 8006

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8006"]
