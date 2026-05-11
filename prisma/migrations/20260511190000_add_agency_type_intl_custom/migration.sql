-- The admin "Onboard Agency" wizard exposes International Organization
-- and Custom / Other in the agency-type dropdown, but the Postgres enum
-- only listed six values, so every Save with one of these values blew
-- up with "agencyType must be one of …" — visible to the operator as a
-- 500 on PATCH /agencies/:id.
ALTER TYPE "AgencyType" ADD VALUE IF NOT EXISTS 'INTERNATIONAL_ORG';
ALTER TYPE "AgencyType" ADD VALUE IF NOT EXISTS 'CUSTOM';
