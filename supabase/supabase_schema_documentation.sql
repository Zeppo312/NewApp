-- SQL-Skript zur Generierung einer Dokumentation des Datenbankschemas
-- Dieses Skript erzeugt eine umfassende Dokumentation des Schemas in verschiedenen Formaten

-- 1. Markdown-Dokumentation des Schemas
SELECT '# Datenbankschema-Dokumentation' AS "Titel";

SELECT '## Übersicht der Tabellen' AS "Abschnitt1";

SELECT '| Nr. | Tabelle | Beschreibung | Anzahl Spalten | Primärschlüssel |' AS "Header1";
SELECT '|-----|---------|-------------|----------------|-----------------|' AS "Header2";

WITH table_info AS (
    SELECT 
        t.table_name,
        obj_description(pgc.oid) AS table_description,
        COUNT(c.column_name) AS column_count,
        string_agg(
            CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN kcu.column_name ELSE NULL END,
            ', '
        ) AS primary_key
    FROM 
        information_schema.tables t
    JOIN 
        pg_catalog.pg_class pgc ON pgc.relname = t.table_name
    JOIN 
        information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    LEFT JOIN 
        information_schema.table_constraints tc ON tc.table_name = t.table_name 
        AND tc.table_schema = t.table_schema 
        AND tc.constraint_type = 'PRIMARY KEY'
    LEFT JOIN 
        information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name 
        AND kcu.table_schema = tc.table_schema
    WHERE 
        t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
    GROUP BY 
        t.table_name, pgc.oid
    ORDER BY 
        t.table_name
)
SELECT 
    '| ' || ROW_NUMBER() OVER (ORDER BY table_name) || 
    ' | ' || table_name || 
    ' | ' || COALESCE(table_description, 'Keine Beschreibung') || 
    ' | ' || column_count || 
    ' | ' || COALESCE(primary_key, 'Kein PK') || 
    ' |' AS "TableList"
FROM 
    table_info
ORDER BY 
    table_name;

SELECT '## Detaillierte Tabellenbeschreibungen' AS "Abschnitt2";

DO $$
DECLARE
    table_record RECORD;
    column_record RECORD;
    fk_record RECORD;
    table_comment TEXT;
BEGIN
    -- Für jede Tabelle in der Datenbank
    FOR table_record IN 
        SELECT 
            table_name 
        FROM 
            information_schema.tables 
        WHERE 
            table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        ORDER BY 
            table_name
    LOOP
        -- Tabellentitel und Beschreibung
        SELECT obj_description(pgc.oid) INTO table_comment
        FROM pg_catalog.pg_class pgc
        WHERE pgc.relname = table_record.table_name;
        
        RAISE NOTICE '';
        RAISE NOTICE '### Tabelle: %', table_record.table_name;
        
        IF table_comment IS NOT NULL THEN
            RAISE NOTICE '';
            RAISE NOTICE '**Beschreibung**: %', table_comment;
        END IF;
        
        -- Spalteninformationen
        RAISE NOTICE '';
        RAISE NOTICE '#### Spalten';
        RAISE NOTICE '';
        RAISE NOTICE '| Spalte | Typ | Nullable | Standard | Beschreibung |';
        RAISE NOTICE '|--------|-----|----------|----------|--------------|';
        
        FOR column_record IN 
            SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                pg_catalog.col_description(format('%I.%I', c.table_schema, c.table_name)::regclass::oid, c.ordinal_position) as column_description
            FROM 
                information_schema.columns c
            WHERE 
                c.table_schema = 'public'
                AND c.table_name = table_record.table_name
            ORDER BY 
                c.ordinal_position
        LOOP
            RAISE NOTICE '| % | % | % | % | % |',
                column_record.column_name,
                column_record.data_type,
                column_record.is_nullable,
                COALESCE(column_record.column_default, ''),
                COALESCE(column_record.column_description, '');
        END LOOP;
        
        -- Fremdschlüsselbeziehungen
        RAISE NOTICE '';
        RAISE NOTICE '#### Fremdschlüssel';
        RAISE NOTICE '';
        
        IF EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = table_record.table_name
        ) THEN
            RAISE NOTICE '| Spalte | Referenzierte Tabelle | Referenzierte Spalte |';
            RAISE NOTICE '|--------|----------------------|---------------------|';
            
            FOR fk_record IN 
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM
                    information_schema.table_constraints AS tc
                JOIN
                    information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN
                    information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE
                    tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = 'public'
                    AND tc.table_name = table_record.table_name
                ORDER BY
                    kcu.column_name
            LOOP
                RAISE NOTICE '| % | % | % |',
                    fk_record.column_name,
                    fk_record.foreign_table_name,
                    fk_record.foreign_column_name;
            END LOOP;
        ELSE
            RAISE NOTICE 'Keine Fremdschlüssel definiert.';
        END IF;
    END LOOP;
END $$;

-- 2. PlantUML-Diagramm des Schemas
SELECT '## PlantUML-Diagramm des Schemas' AS "Abschnitt3";
SELECT 'Kopieren Sie den folgenden Code in einen PlantUML-Editor (z.B. https://www.planttext.com/) um ein ER-Diagramm zu generieren:' AS "PlantUMLInfo";

SELECT '```plantuml' AS "PlantUMLStart";
SELECT '@startuml' AS "PlantUMLHeader1";
SELECT 'hide circle' AS "PlantUMLHeader2";
SELECT 'skinparam linetype ortho' AS "PlantUMLHeader3";

-- Tabellen mit ihren Spalten
DO $$
DECLARE
    table_record RECORD;
    column_record RECORD;
    pk_columns TEXT;
BEGIN
    -- Für jede Tabelle in der Datenbank
    FOR table_record IN 
        SELECT 
            table_name 
        FROM 
            information_schema.tables 
        WHERE 
            table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        ORDER BY 
            table_name
    LOOP
        -- Primärschlüssel ermitteln
        SELECT string_agg(kcu.column_name, ', ') INTO pk_columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = table_record.table_name;
        
        -- Tabelle beginnen
        RAISE NOTICE 'entity "%" {', table_record.table_name;
        
        -- Primärschlüssel markieren
        IF pk_columns IS NOT NULL THEN
            RAISE NOTICE '  + %: PK', pk_columns;
        END IF;
        
        -- Spalten auflisten
        FOR column_record IN 
            SELECT 
                c.column_name,
                c.data_type
            FROM 
                information_schema.columns c
            WHERE 
                c.table_schema = 'public'
                AND c.table_name = table_record.table_name
                AND c.column_name NOT IN (SELECT kcu.column_name 
                                         FROM information_schema.table_constraints tc
                                         JOIN information_schema.key_column_usage kcu
                                         ON tc.constraint_name = kcu.constraint_name
                                         AND tc.table_schema = kcu.table_schema
                                         WHERE tc.constraint_type = 'PRIMARY KEY'
                                         AND tc.table_schema = 'public'
                                         AND tc.table_name = table_record.table_name)
            ORDER BY 
                c.ordinal_position
        LOOP
            RAISE NOTICE '  %: %', column_record.column_name, column_record.data_type;
        END LOOP;
        
        -- Tabelle beenden
        RAISE NOTICE '}';
        RAISE NOTICE '';
    END LOOP;
END $$;

-- Beziehungen zwischen Tabellen
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    -- Für jede Fremdschlüsselbeziehung
    FOR fk_record IN 
        SELECT 
            tc.table_name AS child_table,
            kcu.column_name AS child_column,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column
        FROM 
            information_schema.table_constraints AS tc
        JOIN 
            information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN 
            information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE 
            tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        ORDER BY 
            tc.table_name,
            kcu.column_name
    LOOP
        RAISE NOTICE '"%" }|--|| "%": "%"', fk_record.child_table, fk_record.parent_table, fk_record.child_column;
    END LOOP;
END $$;

SELECT '@enduml' AS "PlantUMLFooter";
SELECT '```' AS "PlantUMLEnd";

-- 3. Mermaid-Diagramm des Schemas
SELECT '## Mermaid-Diagramm des Schemas' AS "Abschnitt4";
SELECT 'Kopieren Sie den folgenden Code in einen Mermaid-Editor (z.B. https://mermaid.live/) um ein ER-Diagramm zu generieren:' AS "MermaidInfo";

SELECT '```mermaid' AS "MermaidStart";
SELECT 'erDiagram' AS "MermaidHeader";

-- Tabellen mit ihren Primärschlüsseln
DO $$
DECLARE
    table_record RECORD;
    pk_columns TEXT;
BEGIN
    -- Für jede Tabelle in der Datenbank
    FOR table_record IN 
        SELECT 
            table_name 
        FROM 
            information_schema.tables 
        WHERE 
            table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        ORDER BY 
            table_name
    LOOP
        -- Primärschlüssel ermitteln
        SELECT string_agg(kcu.column_name, ', ') INTO pk_columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = table_record.table_name;
        
        -- Tabelle definieren
        RAISE NOTICE '    % {', table_record.table_name;
        
        IF pk_columns IS NOT NULL THEN
            RAISE NOTICE '        % PK', pk_columns;
        END IF;
        
        RAISE NOTICE '    }';
    END LOOP;
END $$;

-- Beziehungen zwischen Tabellen
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    -- Für jede Fremdschlüsselbeziehung
    FOR fk_record IN 
        SELECT 
            tc.table_name AS child_table,
            kcu.column_name AS child_column,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column
        FROM 
            information_schema.table_constraints AS tc
        JOIN 
            information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN 
            information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE 
            tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        ORDER BY 
            tc.table_name,
            kcu.column_name
    LOOP
        RAISE NOTICE '    % }|--o{ % : "%"', fk_record.child_table, fk_record.parent_table, fk_record.child_column;
    END LOOP;
END $$;

SELECT '```' AS "MermaidEnd";

-- 4. Zusammenfassung der Beziehungen
SELECT '## Zusammenfassung der Beziehungen' AS "Abschnitt5";

SELECT '| Tabelle | Spalte | Referenzierte Tabelle | Referenzierte Spalte |' AS "RelHeader1";
SELECT '|---------|--------|----------------------|---------------------|' AS "RelHeader2";

SELECT 
    '| ' || tc.table_name || 
    ' | ' || kcu.column_name || 
    ' | ' || ccu.table_name || 
    ' | ' || ccu.column_name || 
    ' |' AS "RelList"
FROM 
    information_schema.table_constraints AS tc
JOIN 
    information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN 
    information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE 
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY 
    tc.table_name,
    kcu.column_name;

-- 5. Zentrale Tabellen (mit den meisten Beziehungen)
SELECT '## Zentrale Tabellen' AS "Abschnitt6";

SELECT '### Als Elterntabelle (wird referenziert von)' AS "Unterabschnitt6_1";

SELECT '| Tabelle | Anzahl Referenzen |' AS "CentralParentHeader1";
SELECT '|---------|-------------------|' AS "CentralParentHeader2";

SELECT 
    '| ' || ccu.table_name || 
    ' | ' || COUNT(*) || 
    ' |' AS "CentralParentTables"
FROM 
    information_schema.table_constraints tc
JOIN 
    information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
GROUP BY 
    ccu.table_name
ORDER BY 
    COUNT(*) DESC;

SELECT '### Als Kindtabelle (referenziert auf)' AS "Unterabschnitt6_2";

SELECT '| Tabelle | Anzahl Referenzen |' AS "CentralChildHeader1";
SELECT '|---------|-------------------|' AS "CentralChildHeader2";

SELECT 
    '| ' || tc.table_name || 
    ' | ' || COUNT(*) || 
    ' |' AS "CentralChildTables"
FROM 
    information_schema.table_constraints tc
WHERE 
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
GROUP BY 
    tc.table_name
ORDER BY 
    COUNT(*) DESC;

-- 6. Tabellen ohne Beziehungen
SELECT '## Isolierte Tabellen' AS "Abschnitt7";

SELECT '### Tabellen ohne eingehende Referenzen' AS "Unterabschnitt7_1";

SELECT '| Tabelle |' AS "NoParentHeader";
SELECT '|---------|' AS "NoParentHeader2";

SELECT 
    '| ' || t.table_name || ' |' AS "NoParentTables"
FROM 
    information_schema.tables t
WHERE 
    t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_name = t.table_name
    )
ORDER BY 
    t.table_name;

SELECT '### Tabellen ohne ausgehende Referenzen' AS "Unterabschnitt7_2";

SELECT '| Tabelle |' AS "NoChildHeader";
SELECT '|---------|' AS "NoChildHeader2";

SELECT 
    '| ' || t.table_name || ' |' AS "NoChildTables"
FROM 
    information_schema.tables t
WHERE 
    t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = t.table_name
    )
ORDER BY 
    t.table_name;

-- 7. Statistiken zum Schema
SELECT '## Statistiken zum Schema' AS "Abschnitt8";

SELECT '| Metrik | Wert |' AS "StatsHeader1";
SELECT '|--------|------|' AS "StatsHeader2";

SELECT 
    '| Anzahl Tabellen | ' || COUNT(*) || ' |' AS "TableCount"
FROM 
    information_schema.tables
WHERE 
    table_schema = 'public' 
    AND table_type = 'BASE TABLE';

SELECT 
    '| Anzahl Spalten | ' || COUNT(*) || ' |' AS "ColumnCount"
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public';

SELECT 
    '| Anzahl Primärschlüssel | ' || COUNT(*) || ' |' AS "PKCount"
FROM 
    information_schema.table_constraints
WHERE 
    constraint_type = 'PRIMARY KEY'
    AND table_schema = 'public';

SELECT 
    '| Anzahl Fremdschlüssel | ' || COUNT(*) || ' |' AS "FKCount"
FROM 
    information_schema.table_constraints
WHERE 
    constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public';

SELECT 
    '| Durchschnittliche Spalten pro Tabelle | ' || 
    ROUND(
        (SELECT COUNT(*)::numeric FROM information_schema.columns WHERE table_schema = 'public') / 
        (SELECT COUNT(*)::numeric FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
    , 2) || 
    ' |' AS "AvgColumnsPerTable";

SELECT 
    '| Tabelle mit den meisten Spalten | ' || 
    t.table_name || ' (' || COUNT(*) || ' Spalten) |' AS "MostColumnsTable"
FROM 
    information_schema.columns c
JOIN 
    information_schema.tables t 
    ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE 
    c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
GROUP BY 
    t.table_name
ORDER BY 
    COUNT(*) DESC
LIMIT 1;

-- 8. Hinweise zur Verwendung
SELECT '## Hinweise zur Verwendung der Diagramme' AS "Abschnitt9";

SELECT '### PlantUML-Diagramm' AS "Unterabschnitt9_1";
SELECT '1. Kopieren Sie den PlantUML-Code in einen Online-Editor wie [PlantText](https://www.planttext.com/)' AS "PlantUMLHint1";
SELECT '2. Das Diagramm wird automatisch generiert und kann als Bild heruntergeladen werden' AS "PlantUMLHint2";
SELECT '3. PlantUML bietet eine detaillierte Darstellung mit allen Spalten und Beziehungen' AS "PlantUMLHint3";

SELECT '### Mermaid-Diagramm' AS "Unterabschnitt9_2";
SELECT '1. Kopieren Sie den Mermaid-Code in einen Online-Editor wie [Mermaid Live](https://mermaid.live/)' AS "MermaidHint1";
SELECT '2. Das Diagramm wird automatisch generiert und kann als SVG oder PNG heruntergeladen werden' AS "MermaidHint2";
SELECT '3. Mermaid bietet eine übersichtlichere Darstellung, die sich gut für die Dokumentation eignet' AS "MermaidHint3";
SELECT '4. Das Diagramm kann direkt in Markdown-Dokumenten verwendet werden, die Mermaid unterstützen (z.B. GitHub)' AS "MermaidHint4";
