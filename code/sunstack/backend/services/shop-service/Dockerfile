FROM python:3.11-slim

WORKDIR /app

COPY services/shop-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Shared libs
COPY libs ./backend/libs

# Service code
COPY services/shop-service ./

EXPOSE 8005

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005"]
