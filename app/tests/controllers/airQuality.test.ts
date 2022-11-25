/// <reference types="@types/jest" />;
import {
  AirQualityReading,
  AirQualityType,
} from "../../src/db/models/AirQualityReading";
import { AirQualitySite } from "../../src/db/models/AirQualitySite";
import { DataSource } from "../../src/db/models/DataSource";
import {
  getObservations,
  AirQualityData,
  getSites,
  Site,
} from "../../src/clients/nswAirQuality";
import {
  callUpdateAirQualityReadings,
  updateAirQualityReadings,
  updateSites,
  getDailyReadings,
} from "../../src/controllers/airQuality";
import * as airQualityController from "../../src/controllers/airQuality";
import {
  UpdateFrequency,
  Frequency,
} from "../../src/db/models/UpdateFrequency";
import { Suburb } from "../../src/db/models/Suburb";
import { updateSuburbGeoJson } from "../../src/util/suburbUtils";
import {
  AirQualityUpdateParams,
  DATASOURCES,
} from "../../src/const/datasource";
import { Op } from "sequelize";

jest.mock("../../src/clients/nswAirQuality", () => {
  return {
    __esModule: true,
    getObservations: jest.fn(),
    getSites: jest.fn(),
  };
});

jest.mock("../../src/util/suburbUtils", () => {
  return {
    __esModule: true,
    updateSuburbGeoJson: jest.fn(),
  };
});

const getObservationsMock = getObservations as jest.MockedFunction<
  typeof getObservations
>;
getObservationsMock.mockResolvedValue([]);

const getSitesMock = getSites as jest.MockedFunction<typeof getSites>;

const updateSuburbGeoJsonMock = updateSuburbGeoJson as jest.MockedFunction<
  typeof updateSuburbGeoJson
>;

describe("airQuality Controller", () => {
  describe("callUpdateAirQualityReadings", () => {
    const updateAirQualityReadingsSpy = jest.spyOn(
      airQualityController,
      "updateAirQualityReadings"
    );
    beforeEach(async () => {
      const sitesApi = await DataSource.create({
        name: "api2",
        uri: "http::/test2",
      });
      await AirQualitySite.create({
        siteId: 5,
        dataSourceId: sitesApi.id,
        position: {
          type: "Point",
          coordinates: [2.235, 5.2],
        },
      });
    });

    test("it should call updateAirQualityReadings the correct number of times", async () => {
      await callUpdateAirQualityReadings(
        { initialise: false },
        new Date("2022-07-07")
      );

      expect(updateAirQualityReadingsSpy).toBeCalledTimes(
        (<AirQualityUpdateParams[]>DATASOURCES.nswAirQualityReadings.params)
          .length
      );
    });

    test("it should call updateAirQualityReadings with the correct values", async () => {
      await callUpdateAirQualityReadings(
        { initialise: false },
        new Date("2022-07-07")
      );
      const sitesMap: { [key: number]: AirQualitySite } = {};
      const sites = await AirQualitySite.findAll();
      sites.map((site) => (sitesMap[site.siteId] = site));
      updateAirQualityReadingsSpy.mock.calls.forEach((call, i) => {
        expect(call).toEqual([
          (<AirQualityUpdateParams[]>DATASOURCES.nswAirQualityReadings.params)[
            i
          ],
          sitesMap,
          new Date("2022-06-30"),
          new Date("2022-07-07"),
        ]);
      });
    });

    test("it should call updateAirQualityReadings with the correct values on initialisation", async () => {
      const endDate = new Date("2022-07-07");
      const startDate = new Date(endDate.getTime());
      startDate.setMonth(endDate.getMonth() - 6);

      await callUpdateAirQualityReadings({ initialise: true }, endDate);
      const sitesMap: { [key: number]: AirQualitySite } = {};
      const sites = await AirQualitySite.findAll();
      sites.map((site) => (sitesMap[site.siteId] = site));
      updateAirQualityReadingsSpy.mock.calls.forEach((call, i) => {
        expect(call).toEqual([
          (<AirQualityUpdateParams[]>DATASOURCES.nswAirQualityReadings.params)[
            i
          ],
          sitesMap,
          startDate,
          endDate,
        ]);
      });
    });

    test("it should throw an error if the fetch errors", async () => {
      getObservationsMock.mockRejectedValue(new Error("fetch readings error"));
      const errorMessages = (<AirQualityUpdateParams[]>(
        DATASOURCES.nswAirQualityReadings.params
      ))
        .map((p) => `Error fetching ${p.parameters[0]}: fetch readings error`)
        .join(", ");
      expect(
        callUpdateAirQualityReadings({ initialise: false }, new Date())
      ).rejects.toThrowError(errorMessages);
    });
  });

  describe("updateAirQualityReadings", () => {
    let initialReadings: AirQualityReading[];
    let readingsApi: DataSource;
    const sitesMap: { [key: number]: AirQualitySite } = {};
    beforeEach(async () => {
      readingsApi = await DataSource.create({
        name: "api1",
        uri: "http::/test",
      });
      const sitesApi = await DataSource.create({
        name: "api2",
        uri: "http::/test2",
      });
      const site = await AirQualitySite.create({
        siteId: 5,
        dataSourceId: sitesApi.id,
        position: {
          type: "Point",
          coordinates: [2.235, 5.2],
        },
      });
      const frequency = await UpdateFrequency.findOne({
        where: { frequency: Frequency.DAILY },
      });

      initialReadings = await Promise.all(
        Array.from({ length: 7 }).map(async (item, idx) => {
          return AirQualityReading.create({
            date: new Date(`2022-10-${idx + 1}`),
            value: idx,
            type: AirQualityType.NO2,
            hour: 0,
            dataSourceId: readingsApi.id,
            airQualitySiteId: site.id,
            updateFrequencyId: frequency?.id,
          });
        })
      );

      const airQualityReadingsApi: AirQualityData[] = Array.from({
        length: 7,
      }).map((item, idx) => {
        const date = String(idx + 5).padStart(2, "0");
        return {
          date: `2022-10-${date}`,
          value: 0.5,
          siteId: 5,
          frequency: Frequency.DAILY,
          type: AirQualityType.NO2,
          quality: null,
          hour: 0,
        };
      });

      getObservationsMock.mockResolvedValue(airQualityReadingsApi);
      sitesMap[site.siteId] = site;
      await updateAirQualityReadings(
        (<AirQualityUpdateParams[]>DATASOURCES.nswAirQualityReadings.params)[0],
        sitesMap,
        new Date("2022-09-30"),
        new Date("2022-10-15")
      );
    });

    test("it should update with new readings", async () => {
      const readings = await AirQualityReading.findAll({});
      expect(readings.length).toBe(11);
    });

    test("it should not update existing readings", async () => {
      const lastUpdatedInitialValues = initialReadings.map((initialReading) =>
        initialReading.updatedAt.getTime()
      );
      const readings = await AirQualityReading.findAll({});
      let notUpdated = 0;
      readings.forEach((reading) => {
        if (lastUpdatedInitialValues.includes(reading.updatedAt.getTime()))
          notUpdated += 1;
      });
      expect(notUpdated).toBe(initialReadings.length);
    });

    test("it should update any values which were null initially", async () => {
      const reading = await AirQualityReading.findOne({
        where: {
          date: {
            [Op.between]: [new Date("2022-10-10"), new Date("2022-10-11")],
          },
        },
      });
      await reading?.update({
        value: null,
      });
      reading?.reload();
      expect(reading?.value).toBe(null);
      await updateAirQualityReadings(
        (<AirQualityUpdateParams[]>DATASOURCES.nswAirQualityReadings.params)[0],
        sitesMap,
        new Date("2022-09-30"),
        new Date("2022-10-15")
      );
      await reading?.reload();
      expect(reading?.value).not.toBe(null);
    });

    test("it should add new readings for the same date and site if they are of different types", async () => {
      const airQualityReadingsNew: AirQualityData[] = [
        {
          date: `2022-07-01`,
          value: 0.5,
          siteId: 5,
          frequency: Frequency.DAILY,
          type: AirQualityType.NO,
          quality: null,
          hour: 0,
        },
      ];
      getObservationsMock.mockResolvedValueOnce(airQualityReadingsNew);
      const wdrParams = (<AirQualityUpdateParams[]>(
        DATASOURCES.nswAirQualityReadings.params
      )).find((params) => params.parameters[0] === "NO");
      await updateAirQualityReadings(
        <AirQualityUpdateParams>wdrParams,
        sitesMap,
        new Date("2022-09-30"),
        new Date("2022-10-15")
      );
      const readings = await AirQualityReading.findAll();
      expect(readings.length).toBe(12);
    });

    test("it should not add new readings if they have the same date/time/type", async () => {
      const airQualityReadingsNew: AirQualityData[] = [
        {
          date: `2022-10-01`,
          value: 0.5,
          siteId: 5,
          frequency: Frequency.DAILY,
          type: AirQualityType.NO2,
          quality: null,
          hour: 0,
        },
      ];
      const oldReadings = await AirQualityReading.findAll();
      getObservationsMock.mockResolvedValueOnce(airQualityReadingsNew);
      const no2Params = (<AirQualityUpdateParams[]>(
        DATASOURCES.nswAirQualityReadings.params
      )).find((params) => params.parameters[0] === "NO2");
      await updateAirQualityReadings(
        <AirQualityUpdateParams>no2Params,
        sitesMap,
        new Date("2022-09-30"),
        new Date("2022-10-15")
      );
      const readings = await AirQualityReading.findAll();
      expect(readings.length).toBe(oldReadings.length);
    });

    test("it should call getDailyObservations with the correct values", () => {
      expect(getObservationsMock).toHaveBeenCalledWith(
        (<AirQualityUpdateParams[]>DATASOURCES.nswAirQualityReadings.params)[0],
        [5],
        "2022-09-30",
        "2022-10-15"
      );
    });
  });

  describe("updateSites", () => {
    beforeEach(async () => {
      const sites: Site[] = [
        {
          region: "test",
          name: "sydney",
        },
        {
          region: "test",
          name: "sydney 11###",
        },
        {
          region: "test",
          name: "woiwej sydney",
        },
        {
          region: "test",
          name: "name2",
        },
      ].map((site, i) => ({
        ...site,
        siteId: i + 1,
        lng: 40,
        lat: 30,
      }));
      getSitesMock.mockResolvedValueOnce(sites);
      await updateSites();
    });

    test("it should add sites within the sydney region", async () => {
      const airQualitySites = await AirQualitySite.findAll({});
      expect(airQualitySites.length).toBe(3);
    });

    test("it should add suburbs with 'sydney' in the name", async () => {
      const airQualitySites = await AirQualitySite.findAll({});
      expect(airQualitySites.length).toBe(3);
    });

    test("it should update the sites", async () => {
      const sites: Site[] = [
        {
          region: "sydney",
          name: "abc",
        },
        {
          region: "test",
          name: "test",
        },
        {
          region: "abc",
          name: "sydney ssss",
        },
      ].map((site, i) => ({
        ...site,
        siteId: i + 10,
        lng: 40,
        lat: 30,
      }));
      getSitesMock.mockResolvedValueOnce(sites);

      await updateSites();
      const airQualitySites = await AirQualitySite.findAll({});
      expect(airQualitySites.length).toBe(5);
    });

    test("it should not create a site if lat/lng is null", async () => {
      const sites: Site[] = [
        {
          region: "sydney",
          name: "test1",
          lat: null,
          lng: null,
          siteId: 1,
        },
      ];
      getSitesMock.mockResolvedValueOnce(sites);
      await updateSites();
      const airQualitySites = await AirQualitySite.findAll({});
      expect(airQualitySites.length).toBe(3);
    });

    test("it should create suburbs if they don't exist", async () => {
      const suburbs = await Suburb.findAll();
      const suburbNames = ["sydney", "sydney 11###", "woiwej sydney"].map(
        (name) => name.toUpperCase()
      );
      expect(suburbs.length).toBe(3);
      for (const suburb of suburbs) {
        expect(suburbNames).toContain(suburb.name);
      }
    });

    test("it should not create a suburb if it already exists", async () => {
      const sites: Site[] = [
        {
          region: "sydney",
          name: "ttttttt",
          lat: null,
          lng: null,
          siteId: 1,
        },
      ];
      getSitesMock.mockResolvedValueOnce(sites);
      await updateSites();
      const suburbs = await Suburb.findAll();
      expect(suburbs.length).toBe(3);
    });

    test("it should call updateSuburbGeoJson", () => {
      expect(updateSuburbGeoJsonMock).toHaveBeenCalled();
    });
  });

  describe("getDailyReadings", () => {
    const createReadings = async (
      numReadings: number,
      date: string,
      datasource: DataSource,
      site: AirQualitySite,
      frequency: UpdateFrequency,
      type: AirQualityType
    ) => {
      await AirQualityReading.bulkCreate(
        Array.from({ length: numReadings }).map((i, idx) => ({
          date: new Date(date),
          value: 1,
          type,
          hour: idx,
          dataSourceId: datasource.id,
          airQualitySiteId: site.id,
          updateFrequencyId: frequency?.id,
        }))
      );
    };

    let sites: AirQualitySite[];
    let datasource: DataSource;

    beforeEach(async () => {
      datasource = await DataSource.create({
        name: "ds",
        uri: "http::/test2",
      });
      const site1 = await AirQualitySite.create({
        siteId: 5,
        dataSourceId: datasource.id,
        position: {
          type: "Point",
          coordinates: [2.235, 5.2],
        },
      });
      const site2 = await AirQualitySite.create({
        siteId: 2,
        dataSourceId: datasource.id,
        position: {
          type: "Point",
          coordinates: [2.235, 5.2],
        },
      });
      sites = [];
      sites.push(site1);
      sites.push(site2);
      const frequency = await UpdateFrequency.findOne({
        where: { frequency: Frequency.DAILY },
      });
      if (!frequency) throw new Error("UpdateFrequency not found");
      await createReadings(
        20,
        "2022-10-03",
        datasource,
        site1,
        frequency,
        AirQualityType.NO2
      );
      await createReadings(
        10,
        "2022-10-04",
        datasource,
        site1,
        frequency,
        AirQualityType.NO2
      );
      await createReadings(
        15,
        "2022-10-05",
        datasource,
        site1,
        frequency,
        AirQualityType.NO2
      );
      await createReadings(
        5,
        "2022-10-05",
        datasource,
        site2,
        frequency,
        AirQualityType.NEPH
      );
    });
    test("it should return the daily readings", async () => {
      const { dailyReadings } = await getDailyReadings();
      expect(dailyReadings).toMatchObject([
        {
          airQualitySiteId: 1,
          date: "2022-10-03",
          value: 20,
          type: AirQualityType.NO2,
        },
        {
          airQualitySiteId: 1,
          date: "2022-10-04",
          value: 10,
          type: AirQualityType.NO2,
        },
        {
          airQualitySiteId: 1,
          date: "2022-10-05",
          value: 15,
          type: AirQualityType.NO2,
        },
        {
          airQualitySiteId: 2,
          date: "2022-10-05",
          value: 5,
          type: AirQualityType.NEPH,
        },
      ]);
    });

    test("it should return airQualitySites for the readings", async () => {
      await AirQualitySite.create({
        siteId: 3,
        dataSourceId: datasource.id,
        position: {
          type: "Point",
          coordinates: [2.235, 5.2],
        },
      });
      const { airQualitySites } = await getDailyReadings();
      expect(airQualitySites.map(({ id }) => id)).toMatchObject(
        sites.map(({ id }) => id)
      );
    });
  });
});
