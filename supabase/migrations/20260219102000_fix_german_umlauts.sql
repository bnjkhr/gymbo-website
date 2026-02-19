-- Normalize enum values to proper German umlauts.
-- This keeps existing rows and simply renames enum labels.

alter type public.equipment_type rename value 'Koerpergewicht' to 'Körpergewicht';
alter type public.difficulty_level rename value 'Anfaenger' to 'Anfänger';
