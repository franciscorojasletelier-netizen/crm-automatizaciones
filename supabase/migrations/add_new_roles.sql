-- Agregar nuevos roles al enum user_role
-- Los valores anteriores: admin, comercial, operaciones, finanzas
-- Los nuevos roles del sistema: super_admin, gerente, produccion, soporte

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'produccion';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'soporte';
