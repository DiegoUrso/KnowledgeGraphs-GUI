# KnowledgeGraphs-GUI

A web application that allows users to visually model data and create complex graph queries without writing code. Visual patterns drawn on the canvas are automatically translated into Cypher queries and executed against a Neo4j database.

## Academic Context
This repository contains the source code developed for the Computer Engineering Final Degree Project at the University of Cantabria. It was developed by **Diego Urso**.

## Features
* **Visual Modeling:** Draw nodes and edges on an interactive canvas to structure graph data.
* **Code-Free Querying:** Design search patterns visually, which compile automatically into valid Cypher syntax.
* **Query Composition:** Combine multiple visual queries using logical and set operators.
* **Database Integration:** Connects directly to Neo4j to execute queries and display tabular results.
* **Local Storage:** Import and export graph models and queries as JSON files.

## Technologies
* Vite
* TypeScript
* Konva.js (HTML5 Canvas)
* Neo4j JavaScript Driver

## Installation and Execution

### Prerequisites
* Node.js installed on your system.
* A running Neo4j Database instance (such as Neo4j Desktop or Neo4j Aura).

### Steps
1. Clone the repository:
```bash
git clone https://github.com/DiegoUrso/KnowledgeGraphs-GUI.git
```

2. Navigate to the project folder:
```bash
cd your-repo-name
```

3. Install dependencies:
```bash
npm install
```

4. Start the development server:
```bash
npm run dev
```

5. Open the given local URL (usually http://localhost:5173/) in your browser.

### Configuration

To connect the application to your database:

1. Open the application in your browser.

2. Click the Settings button on the top right of the toolbar.

3. Enter your Neo4j connection URI, username, and password.

4. Refresh the window. The application will try to connect using the new credentials.