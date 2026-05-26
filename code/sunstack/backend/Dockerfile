FROM python:3.12-slim
WORKDIR /app
ENV TZ=Asia/Ho_Chi_Minh
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY src/main/resources ./src/main/resources

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
