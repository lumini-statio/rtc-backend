### Build stage
#FROM maven:amazoncorretto AS build
#WORKDIR /app
#COPY pom.xml .
#RUN mvn dependency
#
#COPY src/ /app/src/
#
#RUN mvn package -DskipTests

# Step : Package image
FROM ubuntu/jdk:25-26.04_edge
COPY ./rtcbackend-1.0.0.jar app.jar
EXPOSE 8080 8000
ENTRYPOINT ["java", "-jar" , "app.jar"]
