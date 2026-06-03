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
FROM openjdk:25-jdk-slim
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080 8000
ENTRYPOINT ["java", "-jar" , "app.jar"]
