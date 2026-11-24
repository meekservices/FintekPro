import { describe, it, expect } from "vitest";
import { NseBhavcopyService } from "../services/nse-bhavcopy-service";

describe("NSE Bhavcopy Ingestion Service (CM-UDiFF Format)", () => {
  const service = NseBhavcopyService.getInstance();

  it("should generate valid weekday candidate dates in YYYYMMDD format", () => {
    const dates = service.getCandidateDates(5);
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) {
      expect(d).toMatch(/^\d{8}$/);
      // Validate not a weekend
      const year = parseInt(d.substring(0, 4));
      const month = parseInt(d.substring(4, 6)) - 1;
      const day = parseInt(d.substring(6, 8));
      const dateObj = new Date(Date.UTC(year, month, day));
      const dayOfWeek = dateObj.getUTCDay();
      expect(dayOfWeek).not.toBe(0); // Not Sunday
      expect(dayOfWeek).not.toBe(6); // Not Saturday
    }
  });

  it("should parse modern NSE CM-UDiFF Bhavcopy CSV records with exact settlement prices and ISINs", () => {
    const sampleCsv = `TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd,SsnId,NewBrdLotQty,Rmks,Rsvd01,Rsvd02,Rsvd03,Rsvd04
2026-11-20,2026-11-20,CM,NSE,IN,1234,INE002A01018,RELIANCE,EQ,,,,,RELIANCE INDUSTRIES LTD,1369.00,1383.00,1356.10,1377.50,1377.50,1375.60,,,0,0,13167730,17998974119.90,245000,1,1,,,,
2026-11-20,2026-11-20,CM,NSE,IN,5678,INE040A01034,HDFCBANK,EQ,,,,,HDFC BANK LTD,1740.00,1758.00,1735.00,1752.40,1753.00,1741.20,,,0,0,8540000,14965500000.00,185000,1,1,,,,
2026-11-20,2026-11-20,CM,NSE,IN,9012,IN0020210085,SGBNV31VII,GB,,,,,SOVEREIGN GOLD BOND 2.50% 2031-32 SR-VII,12450.00,12500.00,12420.00,12480.00,12480.00,12430.00,,,0,0,1540,19219200.00,85,1,1,,,,
2026-11-20,2026-11-20,CM,NSE,IN,3456,INE999X01011,JUNK_RE,RE,,,,,RIGHTS ENTITLEMENT,5.00,6.00,4.00,4.50,4.50,5.00,,,0,0,1000,4500.00,10,1,1,,,,`;

    const records = service.parseBhavcopy(sampleCsv);

    // Should include EQ and GB series, but exclude RE (Rights)
    expect(records.length).toBe(3);

    const rel = records.find((r) => r.symbol === "RELIANCE");
    expect(rel).toBeDefined();
    expect(rel?.series).toBe("EQ");
    expect(rel?.isin).toBe("INE002A01018");
    expect(rel?.close).toBe(1377.5);
    expect(rel?.open).toBe(1369);
    expect(rel?.high).toBe(1383);
    expect(rel?.low).toBe(1356.1);
    expect(rel?.prevClose).toBe(1375.6);
    expect(rel?.volume).toBe(13167730);

    const hdfc = records.find((r) => r.symbol === "HDFCBANK");
    expect(hdfc).toBeDefined();
    expect(hdfc?.close).toBe(1752.4);

    const sgb = records.find((r) => r.symbol === "SGBNV31VII");
    expect(sgb).toBeDefined();
    expect(sgb?.series).toBe("GB");
    expect(sgb?.isin).toBe("IN0020210085");
    expect(sgb?.close).toBe(12480);
    expect(sgb?.volume).toBe(1540);
  });
});
