FROM eclipse-temurin:17-jdk-alpine AS build
RUN apk add --no-cache curl
WORKDIR /app
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN sed -i 's/$//' mvnw .mvn/wrapper/maven-wrapper.properties && chmod +x mvnw && ./mvnw dependency:go-offline -B
COPY src src
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create necessary directories for uploads and logs
RUN mkdir -p uploads/justificatifs uploads/images uploads/documents uploads/agent logs tokens && \
    chmod -R 755 uploads logs tokens

# Copy built JAR
COPY --from=build /app/target/*.jar app.jar

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=prod"]

