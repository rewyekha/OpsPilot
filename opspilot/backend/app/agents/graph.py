"""
LangGraph investigation graph definition.

Defines the directed graph for a full incident investigation:

  START
    └─► commander_intake
          ├─► metrics_agent    ─┐
          ├─► logs_agent        ├─► [fan-in: all_agents_complete]
          ├─► deployment_agent  │       └─► commander_synthesize
          └─► time_machine_agent┘               └─► [conditional]
                                                      ├─► deep_reasoning (if confidence < 0.7)
                                                      └─► output_formatter
                                                              └─► END

Graph is compiled with a CosmosDB checkpointer so any investigation
can be paused, resumed, or replayed from a checkpoint.
"""
