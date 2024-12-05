# Uruchomienie aplikacji

## Wymagania:
- dostęp do internetu
- platforma do zarządzania kontenerami np. docker, rancher

## Uruchomienie:
### MacOS:
Aby uruchomić aplikację na systemie MacOS należy dodać uprawnienie dla pliku `wait_for_it.sh`

`chmod 777 wait_for_it.sh`

następnie wykonać komendę `docker-compose up --build` i poczekać na zakończenie uruchamiana. Uruchamianie zakończy się wraz z wiadonocią: `OSM data successfully imported.`

Każdorazowo przed ponownym uruchomieniem aplikacji należy się upewnić że nie istnieje poprzedni kontener