// MS-Admin -> MS-notifications : resultat d'une agregation de reseau de
// transport, succes comme echec, a destination du compte admin.
//
// MS-Admin est en Python : il n'a pas de ClientProxy Nest et construit
// l'enveloppe { pattern, data } a la main dans
// app/workers/publishers/notification_publisher.py. Les noms de champs sont
// donc en snake_case, comme ceux de user_created emis par MS-User.
export const TRANSIT_NETWORK_AGGREGATED_PATTERN = 'transit_network_aggregated';

export interface TransitNetworkAggregatedEvent {
  network_id: string;

  // Nom lisible du reseau. Absent si MS-Admin n'a pas retrouve le document,
  // auquel cas on retombe sur network_id dans le corps du message.
  network_name?: string | null;

  // Vocabulaire de la queue gtfs.ingestion.result cote MS-Admin, repris tel
  // quel plutot que traduit en amont : la mise en forme appartient a ce
  // service.
  status: 'ok' | 'error';

  error?: string | null;

  occurred_at?: string;
}
