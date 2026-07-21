import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { MetricsController } from "./platform.controllers";

// Always-on Prometheus scrape endpoint (/metrics, @Public). Reads only MintRepository, so it works in
// both DB and in-memory modes — Grafana/alerting on the box scrapes this.
@Module({
  imports: [StoreModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
