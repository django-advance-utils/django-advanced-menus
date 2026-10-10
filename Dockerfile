FROM python:3.12

ENV PYTHONUNBUFFERED=1

RUN mkdir /app
WORKDIR /app
COPY requirements.txt requirements-no-deps.txt /app/
RUN pip install --upgrade pip
RUN pip install -r /app/requirements.txt
RUN pip install --no-deps -r /app/requirements-no-deps.txt
#copy dist/*.* /app/







