// API pública del módulo <dominio>
// Solo lo que está aquí es importable desde fuera de este módulo.

export { <Dominio>Schema, type <Dominio> }  from './<dominio>.schema';
export { get<Dominio>s, get<Dominio>ById }  from './<dominio>.queries';
export { crear<Dominio>, actualizar<Dominio>, eliminar<Dominio> } from './<dominio>.actions';
// No exportar: controller, test helpers, implementaciones internas
