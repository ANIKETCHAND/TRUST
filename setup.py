from setuptools import setup, find_packages

setup(
    name="crossx",
    version="2.1.0",
    description="CrossX: Production-Grade AI Agent Security and Autonomous Threat Defense SDK",
    author="CrossX Security Team",
    packages=find_packages(include=["crossx", "crossx.*"]),
    install_requires=[
        "httpx>=0.24.0",
        "pydantic>=2.0.0",
    ],
    python_requires=">=3.9",
)
