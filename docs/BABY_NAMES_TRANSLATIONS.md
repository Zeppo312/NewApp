# Babynamen übersetzen

Die deutschen Felder `baby_names.meaning` und `baby_names.origin` bleiben die
Quelle. Englisch und Spanisch werden in `baby_name_translations` gespeichert.
Die App zeigt nur Übersetzungen, deren gespeicherter deutscher Ausgangstext
noch mit dem aktuellen Namen übereinstimmt. Geänderte oder fehlende Einträge
fallen automatisch auf Deutsch zurück.

## 1. Migration anwenden

Die Migration
`supabase/migrations/20260731194443_add_baby_name_translations.sql` legt die
Übersetzungstabelle, RLS-Regeln und die lokalisierte Suchfunktion an. Sie muss
vor dem Batch-Lauf über den normalen Supabase-Deploymentprozess angewendet
werden.

## 2. Schlüssel nur für die aktuelle Shell setzen

Das Skript benötigt einen Supabase-Serverschlüssel und für echte Übersetzungen
einen OpenAI-API-Schlüssel. Beide Schlüssel dürfen weder in die App noch ins
Repository geschrieben werden.

```sh
export SUPABASE_SECRET_KEY='sb_secret_...'
export OPENAI_API_KEY='sk-...'
```

Bei einem älteren Projekt kann vorübergehend
`SUPABASE_SERVICE_ROLE_KEY` anstelle von `SUPABASE_SECRET_KEY` verwendet werden.

## 3. Erst prüfen und dann klein testen

```sh
npm run baby-names:translate -- --dry-run
npm run baby-names:translate -- --limit 25
```

Der Dry-Run ruft OpenAI nicht auf und schreibt keine Daten. Der zweite Befehl
übersetzt höchstens 25 Namen. Anschließend sollten diese Namen in der englischen
und spanischen App-Ansicht stichprobenartig geprüft werden.

## 4. Restlichen Bestand übersetzen

```sh
npm run baby-names:translate
```

Das Skript verarbeitet standardmäßig 25 Namen pro OpenAI-Anfrage und speichert
jedes fertige Paket sofort. Es darf unterbrochen und erneut gestartet werden:
Bereits aktuelle Übersetzungen werden übersprungen.

Nützliche Optionen:

```sh
npm run baby-names:translate -- --batch-size 10
npm run baby-names:translate -- --force
npm run baby-names:translate -- --model gpt-5.6-terra
```

`--force` sollte nur verwendet werden, wenn alle Übersetzungen bewusst neu
erzeugt werden sollen.

## Neue oder geänderte Namen

Das gleiche Kommando kann später erneut ausgeführt werden. Es verarbeitet nur
Namen, bei denen Englisch oder Spanisch fehlt oder deren deutscher Ausgangstext
seit der letzten Übersetzung geändert wurde.

