import { DATASOURCES } from "../const/datasource";
import { DataSource } from "../db/models/DataSource";

export const seed = async () => {
  await DataSource.create({
    name: DATASOURCES.nswTrafficVolumeReadings.name,
    uri: DATASOURCES.nswTrafficVolumeReadings.uri,
    queryStringParams: DATASOURCES.nswTrafficVolumeReadings.queryStringParams,
  });
};
