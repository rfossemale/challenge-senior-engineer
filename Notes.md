# Mejoras a implementar en la API externa

- Endpoint para crear items individuales (POST /todolists/{id}/todoitems). Hoy los items solo se crean juntos con en el POST /todolists.
  No se pueden agregar un item nuevo con el contrato actual.

- Sync incremental por timestamp (GET /todolists?updatedSince=<1112223333>). El GET /todolists trae el estado completo en cada pedido.
  Esto fuerza a reconciliación por snapshot. Un filtro temporal permite traer solo lo modificado desde la última sync.

- Update del PATCH - (items en el PATCH /todolists/{id} ). Hoy este endpoint solo actualiza el nombre de la lista, así que actualizar N     items cambiados exige N requests individuales.

- Propagación de borrados vía deltas (GET /todolists/changes?since=<1112223333> con tombstones, o un deletedSince). Hoy detectamos borrados por ausencia en el snapshot, lo que solo funciona porque traemos todo. Con lectura incremental, necesitaríamos que la API reporte explícitamente qué se borró; eso requiere que la API mantenga soft-deletes (lápidas) del lado externo para poder informarlos.

- Control de concurrencia optimista (ETag + If-Match, o un campo version). Hoy resolvemos conflictos comparando updated_at a mano, lo que asume relojes sincronizados y no detecta ediciones concurrentes de forma confiable. Con ETags, la API rechazaría un update basado en una versión desactualizada (412 Precondition Failed), moviendo la detección de conflictos al nivel del protocolo.

- Idempotencia explícita en creaciones de TodoList y TodoITem (respetar o validar source_id como clave única). Hoy source_id nos sirve para correlacionar, pero si la API garantizara que dos POST con el mismo source_id no crean duplicados, los reintentos tras un fallo parcial serían seguros sin que tengamos que verificar existencia previa.

- Operaciones batch generales (un endpoint que acepte varias operaciones en un request).
