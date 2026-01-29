# Product Overview

Sports Event Monitoring Dashboard - A real-time monitoring application for sports events integrated with AWS MediaLive channels.

## Core Purpose

Monitor and display live sports events (3-point shots, dunks, incidents) from AWS MediaLive channels with real-time event detection, video playback, and highlight clip generation capabilities.

## Key Features

- **Channel Management**: Add, remove, and monitor AWS MediaLive channel status
- **Real-time Event Feed**: Live detection and display of sports events with 5-second polling
- **Video Playback**: HLS stream player for live and recorded content
- **Event Logging**: CloudWatch integration for event history and analysis
- **Event Types**: Supports three-pointer, dunk, incident, and default event classifications
- **Highlight Clip Generation**: Generate MP4 clips from live stream events using MediaPackage Time-shift and MediaConvert
- **Clip Management**: Preview, download, and track clip generation status (PENDING, PROCESSING, COMPLETED, FAILED)

## Target Users

Operations teams and content managers monitoring live sports broadcasts through AWS MediaLive infrastructure.

## Language

Primary documentation and UI text is in Korean (한국어), with code and technical elements in English.
