# Layer 4 — Backend API (NestJS)

> **Document:** 04 din 05
> **Prerequisite:** Layer 3 complet — Mosquitto, TimescaleDB, PostgreSQL funcționale
> **Timp estimat:** 3-4 ore
> **Ce obții la final:** API REST complet + WebSocket + JWT auth + ML scoring integrat

---

## 1. Structura completă a proiectului NestJS

```
~/gateway/api/src/
├── main.ts                        ← entry point, configurare globală
├── app.module.ts                  ← modul rădăcină
│
├── config/
│   └── database.config.ts         ← configurare TypeORM
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts            ← login, generare JWT
│   ├── auth.controller.ts         ← POST /auth/login, /auth/logout
│   ├── jwt.strategy.ts            ← validare token JWT
│   ├── jwt-auth.guard.ts          ← guard pentru rute protejate
│   └── dto/
│       └── login.dto.ts
│
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── user.entity.ts
│
├── sensors/
│   ├── sensors.module.ts
│   ├── sensors.service.ts         ← salvare citiri, query istoric
│   ├── sensors.controller.ts      ← GET /api/sensors/*
│   ├── sensors.gateway.ts         ← WebSocket live data
│   └── entities/
│       ├── sensor-reading.entity.ts
│       └── node.entity.ts
│
├── commands/
│   ├── commands.module.ts
│   ├── commands.service.ts        ← publică comenzi MQTT
│   └── commands.controller.ts     ← POST /api/commands/:nodeId
│
├── rules/
│   ├── rules.module.ts
│   ├── rules.service.ts
│   ├── rules.controller.ts        ← CRUD /api/rules
│   └── rule.entity.ts
│
├── alerts/
│   ├── alerts.module.ts
│   ├── alerts.service.ts
│   ├── alerts.controller.ts       ← GET /api/alerts, PATCH acknowledge
│   └── alert.entity.ts
│
├── ml/
│   ├── ml.module.ts
│   ├── ml.service.ts              ← apelează Python infer.py
│   └── ml.controller.ts           ← GET /api/ml/status
│
└── mqtt/
    ├── mqtt.module.ts
    └── mqtt.service.ts            ← subscriber MQTT (din Layer 3)
```

---

## 2. main.ts — configurare globală

```typescript
// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefix global pentru toate rutele API
  app.setGlobalPrefix('api');

  // Validare automată DTO-uri
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // șterge câmpuri care nu sunt în DTO
    forbidNonWhitelisted: false,
    transform: true,        // transformă tipurile automat
  }));

  // CORS — permite cereri de la aplicația mobilă React Native
  app.enableCors({
    origin: '*',            // în producție: IP-ul telefonului sau '*' pentru local
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Swagger — documentație API auto-generată
  // Accesibilă la http://192.168.1.100:3000/docs
  const config = new DocumentBuilder()
    .setTitle('Smart Home API')
    .setDescription('API local-first pentru sistemul smart home')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');  // 0.0.0.0 = ascultă pe toate interfețele
  console.log(`[API] Rulează pe http://0.0.0.0:${port}`);
  console.log(`[API] Docs: http://192.168.1.100:${port}/docs`);
}

bootstrap();
```

---

## 3. app.module.ts — modul rădăcină

```typescript
// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AuthModule }     from './auth/auth.module';
import { UsersModule }    from './users/users.module';
import { SensorsModule }  from './sensors/sensors.module';
import { CommandsModule } from './commands/commands.module';
import { RulesModule }    from './rules/rules.module';
import { AlertsModule }   from './alerts/alerts.module';
import { MlModule }       from './ml/ml.module';
import { MqttModule }     from './mqtt/mqtt.module';

@Module({
  imports: [
    // Configurare din .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Event emitter pentru comunicare între servicii (MQTT → WebSocket)
    EventEmitterModule.forRoot(),

    // TypeORM — conectare PostgreSQL/TimescaleDB
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host:     config.get('DB_HOST'),
        port:     parseInt(config.get('DB_PORT')),
        database: config.get('DB_NAME'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        entities:    [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,   // NICIODATĂ true în producție — schema e gestionată manual
        logging:     false,
      }),
    }),

    AuthModule,
    UsersModule,
    SensorsModule,
    CommandsModule,
    RulesModule,
    AlertsModule,
    MlModule,
    MqttModule,
  ],
})
export class AppModule {}
```

---

## 4. Auth — JWT Authentication

### 4.1 Entitate User

```typescript
// src/users/user.entity.ts

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_login', nullable: true })
  lastLogin: Date;
}
```

### 4.2 Auth Service

```typescript
// src/auth/auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { username } });

    if (!user) {
      throw new UnauthorizedException('Credențiale invalide');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credențiale invalide');
    }

    // Actualizează last_login
    await this.usersRepo.update(user.id, { lastLogin: new Date() });

    const payload = { sub: user.id, username: user.username };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      }
    };
  }

  async createInitialUser() {
    // Creează userul admin dacă nu există
    const exists = await this.usersRepo.findOne({ where: { username: 'admin' } });
    if (!exists) {
      const hash = await bcrypt.hash('admin123', 10);
      await this.usersRepo.save({
        username: 'admin',
        email: 'admin@smarthome.local',
        passwordHash: hash,
      });
      console.log('[Auth] User admin creat — schimbă parola!');
    }
  }
}
```

### 4.3 Auth Controller

```typescript
// src/auth/auth.controller.ts

import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

class LoginDto {
  @IsString() @IsNotEmpty()
  username: string;

  @IsString() @IsNotEmpty()
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login și obținere JWT token' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }
}
```

### 4.4 JWT Strategy și Guard

```typescript
// src/auth/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number; username: string }) {
    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

```typescript
// src/auth/jwt-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

---

## 5. Sensors — citiri și istoric

### 5.1 Entitate SensorReading

```typescript
// src/sensors/entities/sensor-reading.entity.ts

import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('sensor_readings')
@Index(['nodeId', 'time'])
export class SensorReading {
  @PrimaryColumn({ type: 'timestamptz' })
  time: Date;

  @PrimaryColumn({ name: 'node_id' })
  nodeId: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'float', nullable: true })
  temperature: number;

  @Column({ type: 'float', nullable: true })
  humidity: number;

  @Column({ name: 'gas_level', type: 'int', nullable: true })
  gasLevel: number;

  @Column({ name: 'gas_alert', default: false })
  gasAlert: boolean;

  @Column({ default: false })
  motion: boolean;

  @Column({ name: 'light_lux', type: 'float', nullable: true })
  lightLux: number;

  @Column({ name: 'temp_delta_1h', type: 'float', nullable: true })
  tempDelta1h: number;

  @Column({ name: 'motion_count_1h', type: 'int', nullable: true })
  motionCount1h: number;
}
```

### 5.2 Sensors Service

```typescript
// src/sensors/sensors.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SensorReading } from './entities/sensor-reading.entity';
import { MlService } from '../ml/ml.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class SensorsService {
  constructor(
    @InjectRepository(SensorReading)
    private readingsRepo: Repository<SensorReading>,
    private dataSource: DataSource,
    private mlService: MlService,
    private alertsService: AlertsService,
  ) {}

  async saveReading(mqttPayload: any): Promise<void> {
    const { node_id, timestamp, location, sensors } = mqttPayload;

    // Salvează citirea brută
    const reading = this.readingsRepo.create({
      time:        new Date(timestamp * 1000),
      nodeId:      node_id,
      location:    location,
      temperature: sensors.temperature,
      humidity:    sensors.humidity,
      gasLevel:    sensors.gas_level,
      gasAlert:    sensors.gas_alert,
      motion:      sensors.motion,
      lightLux:    sensors.light_lux,
    });

    await this.readingsRepo.save(reading);

    // Rulează ML scoring dacă modelul e disponibil
    const mlResult = await this.mlService.score({
      ...sensors,
      timestamp,
    });

    if (mlResult.is_anomaly) {
      await this.alertsService.createAlert({
        node_id,
        alert_type: 'ML_ANOMALY',
        severity:   'medium',
        location,
        details: {
          score:       mlResult.score,
          threshold:   mlResult.threshold,
          sensors:     sensors,
        }
      });
    }
  }

  async getLatest(): Promise<any[]> {
    // Folosește view-ul creat în Layer 3
    return this.dataSource.query(`
      SELECT * FROM latest_readings
      ORDER BY node_id
    `);
  }

  async getHistory(params: {
    nodeId?:   string;
    from?:     Date;
    to?:       Date;
    limit?:    number;
    interval?: string;  // '5 minutes', '1 hour', '1 day'
  }): Promise<any[]> {
    const {
      nodeId,
      from    = new Date(Date.now() - 24 * 60 * 60 * 1000), // default: ultimele 24h
      to      = new Date(),
      limit   = 1000,
      interval,
    } = params;

    // Dacă e cerut un interval de agregare, folosim time_bucket TimescaleDB
    if (interval) {
      const nodeFilter = nodeId ? `AND node_id = $3` : '';
      const queryParams: any[] = [from, to];
      if (nodeId) queryParams.push(nodeId);

      return this.dataSource.query(`
        SELECT
          time_bucket($4::interval, time) AS bucket,
          node_id,
          AVG(temperature)  AS temperature,
          AVG(humidity)     AS humidity,
          MAX(gas_level)    AS gas_level,
          BOOL_OR(gas_alert) AS gas_alert,
          BOOL_OR(motion)   AS motion,
          AVG(light_lux)    AS light_lux,
          COUNT(*)          AS sample_count
        FROM sensor_readings
        WHERE time BETWEEN $1 AND $2 ${nodeFilter}
        GROUP BY bucket, node_id
        ORDER BY bucket DESC
        LIMIT $${queryParams.length + 1}
      `, [...queryParams, interval, limit]);
    }

    // Fără agregare — date brute
    const where: any = { time: { $gte: from, $lte: to } };
    if (nodeId) where.nodeId = nodeId;

    return this.dataSource.query(`
      SELECT time, node_id, location, temperature, humidity,
             gas_level, gas_alert, motion, light_lux
      FROM sensor_readings
      WHERE time BETWEEN $1 AND $2
        ${nodeId ? 'AND node_id = $3' : ''}
      ORDER BY time DESC
      LIMIT ${nodeId ? '$4' : '$3'}
    `, nodeId ? [from, to, nodeId, limit] : [from, to, limit]);
  }

  async getStats(nodeId: string, hours: number = 24): Promise<any> {
    const [result] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                    AS total_readings,
        ROUND(AVG(temperature)::numeric, 1)         AS avg_temp,
        ROUND(MIN(temperature)::numeric, 1)         AS min_temp,
        ROUND(MAX(temperature)::numeric, 1)         AS max_temp,
        ROUND(AVG(humidity)::numeric, 1)            AS avg_humidity,
        ROUND(MAX(gas_level)::numeric, 0)           AS max_gas,
        COUNT(*) FILTER (WHERE motion = true)       AS motion_events,
        COUNT(*) FILTER (WHERE gas_alert = true)    AS gas_alerts
      FROM sensor_readings
      WHERE node_id = $1
        AND time > NOW() - INTERVAL '${hours} hours'
    `, [nodeId]);
    return result;
  }

  async updateNodeStatus(statusPayload: any): Promise<void> {
    const { node_id, status } = statusPayload;
    await this.dataSource.query(`
      UPDATE nodes
      SET online = $1, last_seen = NOW()
      WHERE node_id = $2
    `, [status === 'online', node_id]);
  }

  async getActiveRules(nodeId: string): Promise<any[]> {
    return this.dataSource.query(`
      SELECT * FROM automation_rules
      WHERE enabled = true
        AND (node_id = $1 OR node_id IS NULL)
    `, [nodeId]);
  }
}
```

### 5.3 Sensors Controller

```typescript
// src/sensors/sensors.controller.ts

import {
  Controller, Get, Query, Param,
  UseGuards, ParseIntPipe, DefaultValuePipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SensorsService } from './sensors.service';

@ApiTags('sensors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sensors')
export class SensorsController {
  constructor(private sensorsService: SensorsService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Ultimele citiri pentru toate nodurile' })
  getLatest() {
    return this.sensorsService.getLatest();
  }

  @Get('history')
  @ApiOperation({ summary: 'Istoric citiri cu filtre opționale' })
  @ApiQuery({ name: 'nodeId',   required: false })
  @ApiQuery({ name: 'from',     required: false, description: 'ISO 8601 timestamp' })
  @ApiQuery({ name: 'to',       required: false, description: 'ISO 8601 timestamp' })
  @ApiQuery({ name: 'limit',    required: false, type: Number })
  @ApiQuery({ name: 'interval', required: false, description: '5 minutes | 1 hour | 1 day' })
  getHistory(
    @Query('nodeId')   nodeId?: string,
    @Query('from')     from?: string,
    @Query('to')       to?: string,
    @Query('limit', new DefaultValuePipe(1000), ParseIntPipe) limit?: number,
    @Query('interval') interval?: string,
  ) {
    return this.sensorsService.getHistory({
      nodeId,
      from:     from ? new Date(from) : undefined,
      to:       to   ? new Date(to)   : undefined,
      limit,
      interval,
    });
  }

  @Get('stats/:nodeId')
  @ApiOperation({ summary: 'Statistici agregate pentru un nod' })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  getStats(
    @Param('nodeId') nodeId: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
  ) {
    return this.sensorsService.getStats(nodeId, hours);
  }

  @Get(':nodeId/latest')
  @ApiOperation({ summary: 'Ultimele citiri pentru un nod specific' })
  getNodeLatest(@Param('nodeId') nodeId: string) {
    return this.sensorsService.getHistory({ nodeId, limit: 1 });
  }
}
```

---

## 6. Commands — control actuatori

```typescript
// src/commands/commands.controller.ts

import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MqttService } from '../mqtt/mqtt.service';
import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

class CommandDto {
  @IsString()
  @IsIn(['relay_on', 'relay_off', 'relay_toggle', 'buzzer_beep', 'all_off'])
  action: string;

  @IsNumber() @IsOptional()
  relay?: number;       // index 0-3

  @IsNumber() @IsOptional()
  count?: number;       // pentru buzzer_beep

  @IsNumber() @IsOptional()
  duration_ms?: number; // pentru pulse
}

@ApiTags('commands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('commands')
export class CommandsController {
  constructor(private mqttService: MqttService) {}

  @Post(':nodeId')
  @ApiOperation({ summary: 'Trimite comandă la un nod ESP32' })
  sendCommand(
    @Param('nodeId') nodeId: string,
    @Body() dto: CommandDto,
  ) {
    this.mqttService.publishCommand(nodeId, dto);
    return {
      success: true,
      node_id: nodeId,
      command: dto,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':nodeId/relay/:index/on')
  @ApiOperation({ summary: 'Pornește un relay specific' })
  relayOn(
    @Param('nodeId') nodeId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    this.mqttService.publishCommand(nodeId, { action: 'relay_on', relay: index });
    return { success: true, node_id: nodeId, relay: index, state: 'on' };
  }

  @Post(':nodeId/relay/:index/off')
  @ApiOperation({ summary: 'Oprește un relay specific' })
  relayOff(
    @Param('nodeId') nodeId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    this.mqttService.publishCommand(nodeId, { action: 'relay_off', relay: index });
    return { success: true, node_id: nodeId, relay: index, state: 'off' };
  }
}
```

---

## 7. Rules — automatizări

```typescript
// src/rules/rules.controller.ts

import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RulesService } from './rules.service';
import {
  IsString, IsNumber, IsOptional,
  IsBoolean, IsArray, IsIn
} from 'class-validator';

class CreateRuleDto {
  @IsString()
  name: string;

  @IsString() @IsOptional()
  description?: string;

  @IsString() @IsOptional()
  node_id?: string;           // null = toate nodurile

  @IsString()
  @IsIn(['temperature', 'humidity', 'gas_level', 'motion', 'light_lux'])
  sensor: string;

  @IsString()
  @IsIn(['>', '<', '>=', '<=', '=='])
  operator: string;

  @IsNumber()
  threshold: number;

  @IsString() @IsOptional()
  time_from?: string;         // format "HH:MM"

  @IsString() @IsOptional()
  time_to?: string;

  @IsArray() @IsOptional()
  days_of_week?: number[];    // 0=Luni, 6=Duminică

  @IsString()
  @IsIn(['relay_on', 'relay_off', 'buzzer_beep', 'alert'])
  action_type: string;

  @IsString() @IsOptional()
  action_target?: string;

  @IsOptional()
  action_params?: Record<string, any>;

  @IsBoolean() @IsOptional()
  enabled?: boolean;
}

@ApiTags('rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rules')
export class RulesController {
  constructor(private rulesService: RulesService) {}

  @Get()
  @ApiOperation({ summary: 'Listează toate regulile de automatizare' })
  findAll() {
    return this.rulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rulesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Creează o regulă nouă' })
  create(@Body() dto: CreateRuleDto) {
    return this.rulesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizează o regulă existentă' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateRuleDto>,
  ) {
    return this.rulesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rulesService.remove(id);
  }

  @Post('seed-defaults')
  @ApiOperation({ summary: 'Creează regulile implicite hardcodate (cold start)' })
  seedDefaults() {
    return this.rulesService.seedDefaultRules();
  }
}
```

```typescript
// src/rules/rules.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rule } from './rule.entity';

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rule)
    private rulesRepo: Repository<Rule>,
  ) {}

  findAll()                   { return this.rulesRepo.find(); }
  findOne(id: number)         { return this.rulesRepo.findOneBy({ id }); }
  create(dto: any)            { return this.rulesRepo.save(this.rulesRepo.create(dto)); }
  update(id: number, dto: any){ return this.rulesRepo.update(id, dto); }
  remove(id: number)          { return this.rulesRepo.delete(id); }

  async seedDefaultRules() {
    const defaults = [
      {
        name:         'Alertă gaz',
        sensor:       'gas_level',
        operator:     '>',
        threshold:    400,
        action_type:  'alert',
        action_params: { severity: 'critical' },
      },
      {
        name:         'Alertă temperatură ridicată',
        sensor:       'temperature',
        operator:     '>',
        threshold:    35,
        action_type:  'alert',
        action_params: { severity: 'high' },
      },
      {
        name:         'Lumină automată nocturnă',
        sensor:       'motion',
        operator:     '==',
        threshold:    1,
        time_from:    '23:00',
        time_to:      '06:00',
        action_type:  'relay_on',
        action_target: 'relay_0',
        action_params: { relay: 0, auto_off_seconds: 300 },
      },
      {
        name:         'Ventilator la temperatură mare',
        sensor:       'temperature',
        operator:     '>',
        threshold:    28,
        action_type:  'relay_on',
        action_params: { relay: 1 },
      },
    ];

    const created = [];
    for (const rule of defaults) {
      const exists = await this.rulesRepo.findOne({ where: { name: rule.name } });
      if (!exists) {
        created.push(await this.rulesRepo.save(this.rulesRepo.create(rule)));
      }
    }
    return { created: created.length, message: `${created.length} reguli create` };
  }
}
```

---

## 8. Alerts — gestionare alerte

```typescript
// src/alerts/alerts.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './alert.entity';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private alertsRepo: Repository<Alert>,
  ) {}

  async createAlert(payload: {
    node_id:    string;
    alert_type: string;
    severity?:  string;
    location?:  string;
    details?:   any;
  }): Promise<Alert> {
    const alert = this.alertsRepo.create({
      nodeId:    payload.node_id,
      alertType: payload.alert_type,
      severity:  payload.severity || 'medium',
      location:  payload.location,
      details:   payload.details,
    });

    const saved = await this.alertsRepo.save(alert);
    console.log(`[Alert] ${alert.severity.toUpperCase()} — ${alert.alertType} @ ${alert.nodeId}`);
    return saved;
  }

  findAll(params: { acknowledged?: boolean; limit?: number } = {}) {
    const { acknowledged, limit = 50 } = params;
    const where = acknowledged !== undefined ? { acknowledged } : {};
    return this.alertsRepo.find({
      where,
      order: { time: 'DESC' },
      take:  limit,
    });
  }

  async acknowledge(id: number): Promise<void> {
    await this.alertsRepo.update(id, {
      acknowledged:   true,
      acknowledgedAt: new Date(),
    });
  }

  async acknowledgeAll(): Promise<void> {
    await this.alertsRepo
      .createQueryBuilder()
      .update()
      .set({ acknowledged: true, acknowledgedAt: new Date() })
      .where('acknowledged = false')
      .execute();
  }

  getUnreadCount(): Promise<number> {
    return this.alertsRepo.count({ where: { acknowledged: false } });
  }
}
```

```typescript
// src/alerts/alerts.controller.ts

import {
  Controller, Get, Patch, Param,
  Query, UseGuards, ParseIntPipe,
  DefaultValuePipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Listează alerte cu filtru opțional acknowledged' })
  findAll(
    @Query('acknowledged') acknowledged?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.alertsService.findAll({
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      limit,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Numărul de alerte necitite — pentru badge în app' })
  unreadCount() {
    return this.alertsService.getUnreadCount().then(count => ({ count }));
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Marchează o alertă ca citită' })
  acknowledge(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.acknowledge(id).then(() => ({ success: true }));
  }

  @Patch('acknowledge-all')
  @ApiOperation({ summary: 'Marchează toate alertele ca citite' })
  acknowledgeAll() {
    return this.alertsService.acknowledgeAll().then(() => ({ success: true }));
  }
}
```

---

## 9. ML Service — integrare Python

```typescript
// src/ml/ml.service.ts
// Apelează scriptul Python infer.py prin child_process

import { Injectable, OnModuleInit } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

const PYTHON_BIN   = '/home/pi/gateway/ml/venv/bin/python3';
const INFER_SCRIPT = '/home/pi/gateway/ml/infer_single.py';

@Injectable()
export class MlService implements OnModuleInit {
  private modelAvailable = false;

  onModuleInit() {
    this.checkModelAvailability();
  }

  private checkModelAvailability() {
    const modelPath = '/home/pi/gateway/ml/models/isolation_forest.pkl';
    this.modelAvailable = fs.existsSync(modelPath);
    if (this.modelAvailable) {
      console.log('[ML] Model Isolation Forest disponibil');
    } else {
      console.log('[ML] Model indisponibil — cold start, folosesc doar reguli hardcodate');
    }
  }

  async score(sensorData: Record<string, any>): Promise<{
    is_anomaly: boolean;
    score: number | null;
    model_active: boolean;
    reason: string;
  }> {
    if (!this.modelAvailable) {
      return { is_anomaly: false, score: null, model_active: false, reason: 'model_not_trained' };
    }

    try {
      const input = JSON.stringify(sensorData);
      const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [INFER_SCRIPT, '--json', input],
        { timeout: 5000 }
      );
      return JSON.parse(stdout.trim());
    } catch (e) {
      console.error('[ML] Eroare scoring:', e.message);
      return { is_anomaly: false, score: null, model_active: false, reason: `error: ${e.message}` };
    }
  }

  getStatus() {
    this.checkModelAvailability();
    return {
      model_available: this.modelAvailable,
      model_path:      '/home/pi/gateway/ml/models/isolation_forest.pkl',
      retrain_schedule: 'daily at 03:00',
    };
  }
}
```

```typescript
// src/ml/ml.controller.ts

import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MlService } from './ml.service';

@ApiTags('ml')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ml')
export class MlController {
  constructor(private mlService: MlService) {}

  @Get('status')
  @ApiOperation({ summary: 'Status model ML — disponibil, ultima antrenare' })
  getStatus() {
    return this.mlService.getStatus();
  }
}
```

---

## 10. Tabel complet endpoint-uri API

| Method | Endpoint | Auth | Descriere |
|--------|----------|------|-----------|
| POST | `/api/auth/login` | — | Login, returnează JWT |
| GET | `/api/sensors/latest` | JWT | Ultimele citiri toate nodurile |
| GET | `/api/sensors/history` | JWT | Istoric cu filtre (nodeId, from, to, interval) |
| GET | `/api/sensors/stats/:nodeId` | JWT | Min/max/avg per nod |
| GET | `/api/sensors/:nodeId/latest` | JWT | Ultima citire nod specific |
| POST | `/api/commands/:nodeId` | JWT | Trimite comandă la ESP32 |
| POST | `/api/commands/:nodeId/relay/:idx/on` | JWT | Pornește relay |
| POST | `/api/commands/:nodeId/relay/:idx/off` | JWT | Oprește relay |
| GET | `/api/rules` | JWT | Listează reguli |
| POST | `/api/rules` | JWT | Creează regulă |
| PUT | `/api/rules/:id` | JWT | Modifică regulă |
| DELETE | `/api/rules/:id` | JWT | Șterge regulă |
| POST | `/api/rules/seed-defaults` | JWT | Creează reguli implicite |
| GET | `/api/alerts` | JWT | Listează alerte |
| GET | `/api/alerts/unread-count` | JWT | Badge counter pentru app |
| PATCH | `/api/alerts/:id/acknowledge` | JWT | Marchează citit |
| PATCH | `/api/alerts/acknowledge-all` | JWT | Marchează toate citite |
| GET | `/api/ml/status` | JWT | Status model ML |
| WS | `/live` | — | WebSocket stream live |

**WebSocket events emise de server:**
- `sensor_update` — date noi de la ESP32
- `alert` — alertă nouă (gaz, mișcare, ML anomalie)
- `node_status` — nod online/offline

---

## 11. Verificare înainte să treci la Layer 5

```bash
# Testează toate endpoint-urile din terminal

# 1. Login
TOKEN=$(curl -s -X POST http://192.168.1.100:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "Token: $TOKEN"

# 2. Ultimele citiri
curl -s http://192.168.1.100:3000/api/sensors/latest \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 3. Pornește relay 1 pe Node A
curl -s -X POST http://192.168.1.100:3000/api/commands/esp32_node_a/relay/0/on \
  -H "Authorization: Bearer $TOKEN"

# 4. Creează reguli implicite
curl -s -X POST http://192.168.1.100:3000/api/rules/seed-defaults \
  -H "Authorization: Bearer $TOKEN"

# 5. Status ML
curl -s http://192.168.1.100:3000/api/ml/status \
  -H "Authorization: Bearer $TOKEN"

# 6. Swagger UI
# Deschide în browser: http://192.168.1.100:3000/docs
```

- [ ] Login returnează JWT token valid
- [ ] `/api/sensors/latest` returnează date reale din DB
- [ ] `/api/sensors/history` cu `?interval=5 minutes` returnează date agregate
- [ ] Comanda relay pornește/oprește fizic releul pe ESP32
- [ ] Regulile implicite create în DB
- [ ] Alertele din DB sunt vizibile prin API
- [ ] WebSocket emite date live când ESP32 publică
- [ ] Swagger accesibil la `/docs`
- [ ] API răspunde de pe alt dispozitiv în rețea (nu doar localhost)

---

*Următorul document: `05_layer5_mobile.md` — React Native app completă: dashboard live, control relay, grafice istoric, notificări push, offline mode, home screen widget.*
