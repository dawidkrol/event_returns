# Uruchomienie aplikacji

## Wymagania:
- dostęp do internetu
- platforma do zarządzania kontenerami np. docker, rancher

## Uruchomienie:

Należy wykonać komendę `docker-compose up --build` w folderze event_returns i poczekać na zakończenie uruchamiana. Uruchamianie zakończy się wraz z wiadonocią: `OSM data successfully imported.`

Każdorazowo przed ponownym uruchomieniem aplikacji należy się upewnić że nie istnieje poprzedni kontener

### Dostępne endpointy i przykładowe requesty:
#### POST `/api/events`
tworzenie wydarzenia

Body:
```
{
  "eventName": "Annual Tech Conference",
  "eventDescription": "A gathering of technology enthusiasts to discuss the latest trends in the industry.",
  "longitude": 19.830607623181738,
  "latitude": 49.5432717065725044,
  "eventDate": "2024-12-15T10:00:00Z",
  "organizer": {
    "name": "Jane Doe",
    "email": "jane.doe@example.com"
  }
}
```
---
#### POST `/api/{{eventId}}/people`
dodanie uczestników wydarzenia

Body:
```
{
    "email": "dawidkrol9@gmail.com",
    "name": "Dawid Krol"
}
```
---
#### GET `/api/{{eventId}}/people`
lista uczestników wydarzenia

---
#### POST `/api/road/{{userId}}/driver`
ustawienie uczestnika jako kierowce i zwrócenie trasy

Body:
```
{
 "longitude": 19.88338948685331,
 "latitude": 50.0780053897175,
 "numberOfAvailableSeats": 2,
 "initialDepartureTime": "1975-08-19T23:15:30.000Z",
 "finalDepartureTime": "1975-08-19T23:15:31.000Z"
}
```

#### GET `/api/road/{{userId}}`
zwrócenie trasy użytkownika

---


# Problemy:
- jak przetwarzać requesty pasażerów? sekwencyjnie?
- jak zapisywać nowe proponowane trasy w bazie? Jak przełączać po zatwierdzeniu przez kierowce?
