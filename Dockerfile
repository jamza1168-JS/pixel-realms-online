# Pixel Realms Online — game + multiplayer server in one container.
# Build:  docker build -t pixel-realms .
# Run:    docker run -p 8765:8765 pixel-realms
FROM python:3.12-slim
WORKDIR /app
COPY . .
EXPOSE 8765
CMD ["python", "server.py"]
