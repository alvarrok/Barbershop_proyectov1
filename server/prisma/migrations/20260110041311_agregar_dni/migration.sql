-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "creado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "duracion_minutos" INTEGER NOT NULL,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" SERIAL NOT NULL,
    "cliente_nombre" VARCHAR(100) NOT NULL,
    "cliente_dni" VARCHAR(20) NOT NULL,
    "cliente_telefono" VARCHAR(20) NOT NULL,
    "fecha_cita" TIMESTAMP(6) NOT NULL,
    "fecha_fin" TIMESTAMP(6) NOT NULL,
    "estado" VARCHAR(20) DEFAULT 'PENDIENTE',
    "service_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "idx_cliente_telefono" ON "appointments"("cliente_telefono");

-- CreateIndex
CREATE INDEX "idx_fecha_cita" ON "appointments"("fecha_cita");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_servicio" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
