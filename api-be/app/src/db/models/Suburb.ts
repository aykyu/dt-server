import {
  Table,
  Column,
  Model,
  Unique,
  DataType,
  AllowNull,
  HasMany,
  BelongsToMany,
  Default,
} from "sequelize-typescript";
import { AirQualitySite } from "./AirQualitySite";
import { BomStation } from "./BomStation";
import { TrafficIncident } from "./TrafficIncident";
import { TrafficVolumeStation } from "./TrafficVolumeStation";
import { CosGhgEmission } from "./CosGhgEmission";
import { CosGhgEmissionSuburb } from "./CosGhgEmissionSuburb";
import { TrafficIncidentSuburb } from "./TrafficIncidentSuburb";
import { Point, Polygon } from "../../customTypes/geometry";

@Table
export class Suburb extends Model {
  @Unique
  @Column({
    type: DataType.STRING,
    set(name: string) {
      this.setDataValue("name", name.toUpperCase());
    },
  })
  name: string;

  @AllowNull(false)
  @Default(false)
  @Column
  fetchFailed: boolean;

  @AllowNull(true)
  @Column(DataType.GEOMETRY)
  boundary: Polygon;

  @AllowNull(true)
  @Column(DataType.GEOMETRY)
  position: Point;

  @HasMany(() => AirQualitySite, "suburbId")
  airQualitySites: AirQualitySite[];

  @HasMany(() => TrafficVolumeStation, "suburbId")
  trafficVolumeStations: TrafficVolumeStation[];

  @HasMany(() => BomStation, "suburbId")
  bomStations: BomStation[];

  @BelongsToMany(() => CosGhgEmission, () => CosGhgEmissionSuburb)
  cosGhgEmissions: CosGhgEmission[];

  @BelongsToMany(() => TrafficIncident, () => TrafficIncidentSuburb)
  trafficIncidents: TrafficIncident[];
}
