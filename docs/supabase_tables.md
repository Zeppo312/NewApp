# Supabase Tabellen-Übersicht

Diese Dokumentation bietet einen Überblick über alle Tabellen in der Supabase-Datenbank der Wehen-Tracker-App.

## Benutzer und Profil

### 1. `profiles`
Speichert grundlegende Benutzerinformationen.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel, verknüpft mit auth.users |
| first_name | TEXT | Vorname des Benutzers |
| last_name | TEXT | Nachname des Benutzers |
| avatar_url | TEXT | URL zum Profilbild |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 2. `user_settings`
Speichert benutzerspezifische Einstellungen und Informationen zur Schwangerschaft.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| due_date | TIMESTAMP | Errechneter Geburtstermin |
| is_baby_born | BOOLEAN | Flag, ob das Baby bereits geboren ist |
| username | TEXT | Benutzername (wird in der Profil-Seite verwendet) |
| baby_name | TEXT | Name des Babys |
| baby_gender | TEXT | Geschlecht des Babys |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

## Wehen-Tracking

### 3. `contractions`
Speichert Informationen zu den aufgezeichneten Wehen.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| start_time | TIMESTAMP | Startzeit der Wehe |
| end_time | TIMESTAMP | Endzeit der Wehe |
| duration | INTEGER | Dauer der Wehe in Sekunden |
| interval | INTEGER | Zeit seit der letzten Wehe in Sekunden |
| intensity | TEXT | Intensität der Wehe (schwach, mittel, stark) |
| created_at | TIMESTAMP | Erstellungszeitpunkt |

## Baby-Informationen

### 4. `baby_info`
Speichert grundlegende Informationen zum Baby.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| name | TEXT | Name des Babys |
| birth_date | TIMESTAMP | Geburtsdatum |
| weight | TEXT | Geburtsgewicht |
| height | TEXT | Größe bei der Geburt |
| photo_url | TEXT | URL zum Babyfoto |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 5. `baby_diary`
Speichert Tagebucheinträge zum Baby.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| entry_date | TIMESTAMP | Datum des Eintrags |
| mood | TEXT | Stimmung |
| content | TEXT | Inhalt des Tagebucheintrags |
| photo_url | TEXT | URL zu einem Foto |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 6. `baby_daily`
Speichert tägliche Aktivitäten des Babys (Mahlzeiten, Windelwechsel, etc.).

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| entry_date | TIMESTAMP | Datum des Eintrags |
| entry_type | TEXT | Typ des Eintrags (diaper, feeding, sleep, etc.) |
| start_time | TIMESTAMP | Startzeit der Aktivität |
| end_time | TIMESTAMP | Endzeit der Aktivität |
| notes | TEXT | Notizen |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

## Entwicklung und Meilensteine

### 7. `baby_development_phases`
Speichert Informationen zu den Entwicklungsphasen des Babys.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| phase_number | INTEGER | Nummer der Phase |
| title | TEXT | Titel der Phase |
| description | TEXT | Beschreibung der Phase |
| age_range | TEXT | Altersbereich der Phase |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 8. `baby_milestones`
Speichert Meilensteine in der Entwicklung des Babys.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| phase_id | UUID | Fremdschlüssel zu baby_development_phases |
| title | TEXT | Titel des Meilensteins |
| description | TEXT | Beschreibung des Meilensteins |
| position | INTEGER | Position in der Liste der Meilensteine |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 9. `baby_milestone_progress`
Speichert den Fortschritt des Babys bei den Meilensteinen.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| milestone_id | UUID | Fremdschlüssel zu baby_milestones |
| is_completed | BOOLEAN | Flag, ob der Meilenstein erreicht wurde |
| completion_date | TIMESTAMP | Datum, an dem der Meilenstein erreicht wurde |
| notes | TEXT | Notizen |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 10. `baby_current_phase`
Speichert die aktuelle Entwicklungsphase des Babys.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| phase_id | UUID | Fremdschlüssel zu baby_development_phases |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

## Geburtsplan

### 11. `geburtsplan`
Speichert den Geburtsplan des Benutzers.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| content | TEXT | Textinhalt des Geburtsplans |
| structured_data | JSONB | Strukturierte Daten des Geburtsplans |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

## Krankenhaus-Checkliste

### 12. `hospital_checklist`
Speichert Einträge für die Krankenhaus-Checkliste.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| item_name | TEXT | Name des Eintrags |
| is_checked | BOOLEAN | Flag, ob der Eintrag abgehakt wurde |
| category | TEXT | Kategorie des Eintrags |
| notes | TEXT | Notizen |
| position | INTEGER | Position in der Liste |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

## Mama Selfcare

### 13. `selfcare_entries`
Speichert Einträge für die Mama Selfcare-Funktion.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| date | TIMESTAMP | Datum des Eintrags |
| mood | TEXT | Stimmung |
| journal_entry | TEXT | Tagebucheintrag |
| sleep_hours | SMALLINT | Schlafstunden |
| water_intake | SMALLINT | Wasseraufnahme |
| exercise_done | BOOLEAN | Flag, ob Sport gemacht wurde |
| selfcare_activities | TEXT[] | Liste der Selfcare-Aktivitäten |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

## Wiki und FAQ

### 14. `wiki_categories`
Speichert Kategorien für das Mini-Wiki.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| name | TEXT | Name der Kategorie |
| icon | TEXT | Icon der Kategorie |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 15. `wiki_articles`
Speichert Artikel für das Mini-Wiki.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| title | TEXT | Titel des Artikels |
| category_id | UUID | Fremdschlüssel zu wiki_categories |
| teaser | TEXT | Kurzbeschreibung des Artikels |
| reading_time | TEXT | Lesezeit |
| content | JSONB | Inhalt des Artikels |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 16. `wiki_favorites`
Speichert Favoriten des Benutzers im Mini-Wiki.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| user_id | UUID | Fremdschlüssel zu auth.users |
| article_id | UUID | Fremdschlüssel zu wiki_articles |
| created_at | TIMESTAMP | Erstellungszeitpunkt |

### 17. `faq_categories`
Speichert Kategorien für die FAQ.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| name | TEXT | Name der Kategorie |
| icon | TEXT | Icon der Kategorie |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

### 18. `faq_entries`
Speichert Einträge für die FAQ.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primärschlüssel |
| category_id | UUID | Fremdschlüssel zu faq_categories |
| question | TEXT | Frage |
| answer | TEXT | Antwort |
| order_number | INTEGER | Reihenfolge |
| created_at | TIMESTAMP | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Letzter Aktualisierungszeitpunkt |

## Hinweise zur Nutzername-Speicherung

Der Nutzername wird in der `user_settings`-Tabelle gespeichert und in der Profil-Seite angezeigt. Es gibt jedoch keine explizite Migration, die ein `username`-Feld zur `user_settings`-Tabelle hinzufügt. Es scheint, dass dieses Feld in der Anwendung verwendet wird, aber möglicherweise nicht explizit in der Datenbank definiert ist.

Alternativ werden Benutzerinformationen auch in der `profiles`-Tabelle gespeichert, die `first_name` und `last_name` enthält. Diese Tabelle wird automatisch für jeden neuen Benutzer erstellt.

## Beziehungen zwischen den Tabellen

- Alle Tabellen mit `user_id` sind mit der `auth.users`-Tabelle verknüpft, die von Supabase für die Authentifizierung verwendet wird.
- Die `baby_milestones`-Tabelle ist mit der `baby_development_phases`-Tabelle verknüpft.
- Die `baby_milestone_progress`-Tabelle ist mit der `baby_milestones`-Tabelle verknüpft.
- Die `baby_current_phase`-Tabelle ist mit der `baby_development_phases`-Tabelle verknüpft.
- Die `wiki_articles`-Tabelle ist mit der `wiki_categories`-Tabelle verknüpft.
- Die `wiki_favorites`-Tabelle ist mit der `wiki_articles`-Tabelle verknüpft.
- Die `faq_entries`-Tabelle ist mit der `faq_categories`-Tabelle verknüpft.
